import AuraActiveEffectData from "./AuraActiveEffectData.mjs";
import AuraActiveEffectSheet from "./AuraActiveEffectSheet.mjs";
import { executeScript, getAllAuraEffects, getNearbyTokens, getTokenToTokenDistance, isFinalMovementComplete, removeAndReplaceAuras } from "./helpers.mjs";
import { applyAuraEffects, deleteEffects } from "./queries.mjs";
import { registerSettings } from "./settings.mjs";
import { overrideSheets } from "./plugins/pluginHelpers.mjs";
import { canvasInit, destroyToken, drawGridLayer, drawToken, refreshToken, updateAllVisualizations, updateTokenVisualization } from "./auraVisualization.mjs";
import { migrate } from "./migrations.mjs";

// Track whether the "with no GM this no work" warning has been seen
let seenWarning = false;

/**
 * Provided the arguments for the updateToken hook, checks if any effects on the token are aura source effects
 * and, if so, removes/adds to nearby tokens as necessary. Also checks if moving should remove non-source aura
 * effects (or add them) and does so if necessary.
 * @param {TokenDocument} token     The token being updated
 * @param {Object} updates          The updates
 * @param {Object} options          Additional options
 * @param {string} userId           The initiating User's ID
 */
async function updateToken(token, updates, options, userId) {
  updateTokenVisualization(token, updates);
  // Exit early for non-initiators, if no active GM, or if non-movement update
  if (game.user.id !== userId) return;
  const activeGM = game.users.activeGM;
  if (!activeGM) {
    if (!seenWarning) {
      ui.notifications.warn("ACTIVEAURAS.NoActiveGM", { localize: true });
      seenWarning = true;
    }
    return;
  }
  if (!token.actor) return;
  if (updates.hidden) {
    const toRemoveSourceEffects = getAllAuraEffects(token.actor)[1].filter(e => e.system.disableOnHidden);
    const toRemoveAppliedEffects = canvas.scene.tokens
      .filter(t => t.actor && (t !== token))
      .flatMap(t => t.actor.appliedEffects)
      .filter(e => e.flags?.ActiveAuras?.fromAura && toRemoveSourceEffects.some(sourceEff => e.origin === sourceEff.uuid));
    if (toRemoveAppliedEffects.length) removeAndReplaceAuras(toRemoveAppliedEffects, token.parent);
  }
  if (!("x" in updates) && !("y" in updates) && !("elevation" in updates) && !("hidden" in updates)) return;
  const [activeSourceEffects, inactiveSourceEffects] = getAllAuraEffects(token.actor);
  const inactiveUuids = inactiveSourceEffects.map(e => e.uuid);

  // Get start-of-movement in-range tokens for each aura source effect
  const preMoveRanges = {};
  for (const effect of activeSourceEffects) {
    const { distance: radius, disposition, collisionTypes } = effect.system;
    if (!radius) continue;
    preMoveRanges[effect.uuid] = new Set(getNearbyTokens(token, radius, { disposition, collisionTypes }).map(t => t.actor));
  }
  await token.object.movementAnimationPromise;

  // Get end-of-movement in-range tokens for each aura source effect, removing effects which should be removed,
  // adding effects which should be added IF this is the final segment of movement
  const actorToEffectsMap = {};
  for (const effect of activeSourceEffects) {
    const { distance: radius, disposition, collisionTypes } = effect.system;
    if (!radius) continue;
    const preMoveRange = preMoveRanges[effect.uuid];
    const postMoveRange = new Set(
      getNearbyTokens(token, radius, { disposition, collisionTypes })
      .filter(t => executeScript(token, t, effect))
      .map(t => t.actor)
    );
    const toDelete = Array.from(preMoveRange.difference(postMoveRange)).map(a => a.effects.find(e => e.origin === effect.uuid));

    // Grab any lingering effects from now-inactive auras, too
    const additionalDeletion = token.parent.tokens.map(t => t.actor.appliedEffects.filter(e => inactiveUuids.includes(e.origin))).flat();

    await removeAndReplaceAuras(toDelete.concat(additionalDeletion).filter(e => e), token.parent);

    if (isFinalMovementComplete(token)) {
      const toAddTo = Array.from(postMoveRange.filter(a => (a !== token.actor) && !a?.effects.find(e => e.origin === effect.uuid))).map(a => a?.uuid);
      for (const actorUuid of toAddTo) {
        actorToEffectsMap[actorUuid] = (actorToEffectsMap[actorUuid] ?? []).concat(effect.uuid);
      }
    }
  }
  if (isFinalMovementComplete(token)) {
    await activeGM.query("ActiveAuras.applyAuraEffects", actorToEffectsMap);
  }

  const currentAppliedAuras = token.actor.appliedEffects.filter(i => i.flags?.ActiveAuras?.fromAura);
  // Get all aura source effects on the scene, split into "actor shouldn't have" and "actor should have"
  const [sceneAurasToRemove, sceneAurasToAdd] = token.parent.tokens.reduce(([toRemove, toAdd], sourceToken) => {
    if (sourceToken.actor === token.actor) return [toRemove, toAdd];
    // -1 if enemies, 0 if at least one is neutral, 1 if allied
    // TODO: account for secret? Should secret be treated as hostile, friendly, or neutral?
    // Currently is -2, 0, or 2, so will only really work with "any"
    const disposition = token.disposition * sourceToken.disposition;
    const [activeAuraEffects, inactiveAuraEffects] = getAllAuraEffects(sourceToken.actor);
    const currentlyAppliedToRemove = currentAppliedAuras.filter(appliedEffect => inactiveAuraEffects.some(inactiveEffect => appliedEffect.origin === inactiveEffect.uuid));
    if (inactiveAuraEffects.length) toRemove.push(...currentlyAppliedToRemove);
    const auraEffects = activeAuraEffects
      .filter(e => [0, disposition].includes(e.system.disposition));
    if (!auraEffects.length) return [toRemove, toAdd];

    for (const currEffect of auraEffects) {
      const distance = getTokenToTokenDistance(sourceToken, token, { collisionTypes: currEffect.system.collisionTypes });
      const currentlyApplied = currentAppliedAuras.find(e => e.origin === currEffect.uuid);
      if ((currEffect.system.distance < distance) || !executeScript(sourceToken, token, currEffect)) {
        if (currentlyApplied) toRemove.push(currentlyApplied);
      } else toAdd.push(currEffect);
    }

    // TODO: Can I do this clever thing and still handle the proper collision checks? 
    // Would prefer not to repeat distance checks unnecessarily
    // const distance = getTokenToTokenDistance(token, sourceToken);
    // toRemove.push(...auraEffects.filter(e => e.system.distance < distance));
    // toAdd.push(...auraEffects.filter(e => e.system.distance >= distance));
    return [toRemove, toAdd]
  }, [[], []]);

  for (const effect of token.actor.appliedEffects) {
    if (!effect.flags?.ActiveAuras?.fromAura) continue;
    const sourceEffect = fromUuidSync(effect.origin);
    if (!sourceEffect || sourceEffect.disabled || sourceEffect.isSuppressed) sceneAurasToRemove.push(effect);
  }

  // Remove effects actor shouldn't have, add effects actor should have (if final segment of token's movement)
  if (sceneAurasToRemove.length) await removeAndReplaceAuras(sceneAurasToRemove, token.parent);
  if (sceneAurasToAdd.length && isFinalMovementComplete(token)) await activeGM.query("ActiveAuras.applyAuraEffects", {
    [token.actor.uuid]: sceneAurasToAdd.map(e => e.uuid)
  });
}

/**
 * Provided the arguments for the updateActiveEffect hook, removes any child effects on the scene for a source
 * aura effect, or adds to the proper tokens, depending on whether the effect was enabled or disabled
 * @param {ActiveEffect} effect     The effect being updated
 * @param {Object} updates          The updates
 * @param {Object} options          Additional options
 * @param {String} userId           The initiating User's ID
 */
async function updateActiveEffect(effect, updates, options, userId) {
  if (game.user.id !== userId) return;
  if (effect.type !== "ActiveAuras.aura") return;
  if (!updates.hasOwnProperty("disabled")) return;
  if (!canvas.scene) return;
  const actor = (effect.parent instanceof Actor) ? effect.parent : effect.parent?.parent;
  const [token] = actor?.getActiveTokens(false, true);
  if (!token) return;
  const activeGM = game.users.activeGM;
  if (!activeGM) {
    if (!seenWarning) {
      ui.notifications.warn("ACTIVEAURAS.NoActiveGM", { localize: true });
      seenWarning = true;
    }
    return;
  }
  if (updates.disabled) {
    const toRemoveAppliedEffects = canvas.scene.tokens
      .filter(t => t.actor && (t.actor !== actor))
      .flatMap(t => t.actor.appliedEffects)
      .filter(e => e.flags?.ActiveAuras?.fromAura && e.origin === effect.uuid);
    await removeAndReplaceAuras(toRemoveAppliedEffects, canvas.scene);
  } else {
    // TODO: Maybe refactor this logic so that it can be utilized in the main updateToken function
    const { distance: radius, disposition, collisionTypes } = effect.system;
    if (!radius) return;
    const tokensInRange = getNearbyTokens(token, radius, { disposition, collisionTypes }).map(t => t.actor)
    const toAddTo = tokensInRange.filter(a => (a !== token.actor) && !a?.effects.find(e => e.origin === effect.uuid)).map(a => a?.uuid);
    const actorToEffectsMap = Object.fromEntries(toAddTo.map(actorUuid => [actorUuid, [effect.uuid]]));
    await activeGM.query("ActiveAuras.applyAuraEffects", actorToEffectsMap);
  }
}

/**
 * Provided the arguments for the deleteActiveEffect hook, removes any child effects on the scene for a deleted
 * source aura effect
 * @param {ActiveEffect} effect     The deleted Active Effect
 * @param {Object} options          Additional options
 * @param {string} userId           The initiating User's ID
 */
async function deleteActiveEffect(effect, options, userId) {
  if (game.user.id !== userId) return;
  if (effect.type !== "ActiveAuras.aura") return;
  if (!canvas.scene) return;
  const actor = (effect.parent instanceof Actor) ? effect.parent : effect.parent?.parent;
  if (!actor) return;
  const activeGM = game.users.activeGM;
  if (!activeGM) {
    if (!seenWarning) {
      ui.notifications.warn("ACTIVEAURAS.NoActiveGM", { localize: true });
      seenWarning = true;
    }
    return;
  }
  const toRemoveAppliedEffects = canvas.scene.tokens
    .filter(t => t.actor && (t.actor !== actor))
    .flatMap(t => t.actor.appliedEffects)
    .filter(e => e.flags?.ActiveAuras?.fromAura && e.origin === effect.uuid);
  await removeAndReplaceAuras(toRemoveAppliedEffects, canvas.scene);
}

/**
 * Injects a button to transform the effect into an "Aura Active Effect" when the AE Config sheet is rendered
 * @param {ActiveEffectConfig} app  The Active Effect Config sheet being rendered
 * @param {HTMLElement} html        The HTML Element
 */
function injectAuraButton(app, html) {
  const typesToInjectOn = ["base"];
  if (!typesToInjectOn.includes(app.document.type)) return;
  const template = document.createElement("template");
  template.innerHTML = `
    <div class="form-group">
      <label>Active Auras</label>
      <div class="form-fields">
        <button type="button" data-tooltip="ACTIVEAURAS.ConvertToAuraHint">
          <i class="fa-solid fa-person-rays"></i>
          ${game.i18n.localize("ACTIVEAURAS.ConvertToAura")}
        </button>
      </div>
    </div>
  `;
  const element = template.content.children[0];
  html.querySelector("[data-tab=details] > .form-group.statuses")?.before(element);
  element.addEventListener("click", () => {
    const currType = app.document.type;
    const updates = app._processFormData(null, app.form, new foundry.applications.ux.FormDataExtended(app.form));
    // Ensure changes are properly serialized into an array
    if (foundry.utils.getType(updates.changes) !== "Array") updates.changes = Object.values(updates.changes ?? {});
    updates.type = "ActiveAuras.aura";
    foundry.utils.setProperty(updates, "flags.ActiveAuras.originalType", currType);
    updates["==system"] = {};
    return app.document.update(updates);
  });
}

function registerHooks() {
  // Effect application/removal-specific hooks
  Hooks.on("updateToken", updateToken);
  Hooks.on("renderActiveEffectConfig", injectAuraButton);
  Hooks.on("updateActiveEffect", updateActiveEffect);
  Hooks.on("deleteActiveEffect", deleteActiveEffect);

  // Visualization-specific hooks
  Hooks.on("canvasInit", canvasInit)
  Hooks.on("drawGridLayer", drawGridLayer);
  Hooks.on("drawToken", drawToken);
  Hooks.on("destroyToken", destroyToken);
  Hooks.on("refreshToken", refreshToken);
  Hooks.on("initializeLightSources", updateAllVisualizations);
}

function registerQueries() {
  CONFIG.queries["ActiveAuras.deleteEffects"] = deleteEffects;
  CONFIG.queries["ActiveAuras.applyAuraEffects"] = applyAuraEffects;
}

function registerAuraType() {
  Object.assign(CONFIG.ActiveEffect.dataModels, {
    "ActiveAuras.aura": AuraActiveEffectData
  });
  foundry.applications.apps.DocumentSheetConfig.registerSheet(ActiveEffect, "ActiveAuras", AuraActiveEffectSheet, {
    label: "ACTIVEAURAS.SHEETS.AuraActiveEffectSheet",
    types: ["ActiveAuras.aura"],
    makeDefault: true
  });
}

Hooks.once("init", () => {
  registerHooks();
  registerQueries();
  registerAuraType();
  registerSettings();
  CONFIG.Canvas.polygonBackends.aura = foundry.canvas.geometry.ClockwiseSweepPolygon;
});

Hooks.once("ready", () => {
  overrideSheets();
  if (game.user.isActiveGM) migrate();
});
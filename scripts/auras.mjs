import AuraActiveEffectData from "./AuraActiveEffectData.mjs";
import AuraActiveEffectSheet from "./AuraActiveEffectSheet.mjs";
import { executeScript, getAllAuraEffects, getNearbyTokens, getTokenToTokenDistance, isFinalMovementComplete } from "./helpers.mjs";
import { applyAuraEffects, deleteAuraEffects, deleteEffects } from "./queries.mjs";
import { registerSettings } from "./settings.mjs";
import { overrideSheets } from "./plugins/pluginHelpers.mjs";
import { canvasInit, destroyToken, drawGridLayer, drawToken, refreshToken, updateAllVisualizations, updateTokenVisualization } from "./auraVisualization.mjs";

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
      ui.notifications.warn("AURAS.NoActiveGM", { localize: true });
      seenWarning = true;
    }
    return;
  }
  if (!token.actor) return;
  if (!("x" in updates) && !("y" in updates) && !("elevation" in updates)) return;
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
    const toDelete = Array.from(preMoveRange.difference(postMoveRange)).map(a => a.effects.find(e => e.origin === effect.uuid)?.uuid);

    // Grab any lingering effects from now-inactive auras, too
    const additionalDeletion = token.parent.tokens.map(t => t.actor.appliedEffects.filter(e => inactiveUuids.includes(e.origin)).map(e => e.uuid)).flat();
    await activeGM.query("auras.deleteEffects", { effectUuids: toDelete.concat(additionalDeletion) })
    if (isFinalMovementComplete(token)) {
      const toAddTo = Array.from(postMoveRange.filter(a => (a !== token.actor) && !a?.effects.find(e => e.origin === effect.uuid))).map(a => a?.uuid);
      for (const actorUuid of toAddTo) {
        actorToEffectsMap[actorUuid] = (actorToEffectsMap[actorUuid] ?? []).concat(effect.uuid)
      }
    }
  }
  if (isFinalMovementComplete(token)) {
    await activeGM.query("auras.applyAuraEffects", actorToEffectsMap);
  }

  // Get all aura source effects on the scene, split into "actor shouldn't have" and "actor should have"
  const [sceneAurasToRemove, sceneAurasToAdd] = token.parent.tokens.reduce(([toRemove, toAdd], sourceToken) => {
    if (sourceToken.actor === token.actor) return [toRemove, toAdd];
    // -1 if enemies, 0 if at least one is neutral, 1 if allied
    // TODO: account for secret? Should secret be treated as hostile, friendly, or neutral?
    // Currently is -2, 0, or 2, so will only really work with "any"
    const disposition = token.disposition * sourceToken.disposition;
    const [activeAuraEffects, inactiveAuraEffects] = getAllAuraEffects(sourceToken.actor);
    if (inactiveAuraEffects.length) toRemove.push(...inactiveAuraEffects);
    const auraEffects = activeAuraEffects
      .filter(e => [0, disposition].includes(e.system.disposition));
    if (!auraEffects.length) return [toRemove, toAdd];

    for (const currEffect of auraEffects) {
      const distance = getTokenToTokenDistance(sourceToken, token, { collisionTypes: currEffect.system.collisionTypes });
      if ((currEffect.system.distance < distance) || !executeScript(sourceToken, token, currEffect)) toRemove.push(currEffect);
      else toAdd.push(currEffect);
    }

    // TODO: Can I do this clever thing and still handle the proper collision checks? 
    // Would prefer not to repeat distance checks unnecessarily
    // const distance = getTokenToTokenDistance(token, sourceToken);
    // toRemove.push(...auraEffects.filter(e => e.system.distance < distance));
    // toAdd.push(...auraEffects.filter(e => e.system.distance >= distance));
    return [toRemove, toAdd]
  }, [[], []]);

  for (const effect of token.actor.appliedEffects) {
    if (!effect.flags?.auras?.fromAura) continue;
    const sourceEffect = fromUuidSync(effect.origin);
    if (!sourceEffect || sourceEffect.disabled || sourceEffect.isSuppressed) sceneAurasToRemove.push({ uuid: effect.origin });
  }

  // Remove effects actor shouldn't have, add effects actor should have (if final segment of token's movement)
  if (sceneAurasToRemove.length) await activeGM.query("auras.deleteAuraEffects", {
    [token.actor.uuid]: sceneAurasToRemove.map(e => e.uuid)
  });
  if (sceneAurasToAdd.length && isFinalMovementComplete(token)) await activeGM.query("auras.applyAuraEffects", {
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
  if (effect.type !== "auras.aura") return;
  if (!updates.hasOwnProperty("disabled")) return;
  if (!canvas.scene) return;
  const actor = (effect.parent instanceof Actor) ? effect.parent : effect.parent?.parent;
  const [token] = actor?.getActiveTokens(false, true);
  if (!token) return;
  const activeGM = game.users.activeGM;
  if (!activeGM) {
    if (!seenWarning) {
      ui.notifications.warn("AURAS.NoActiveGM", { localize: true });
      seenWarning = true;
    }
    return;
  }
  if (updates.disabled) {
    const actorEffectEntries = canvas.scene.tokens.filter(t => t.actor && t.actor !== actor).map(t => [t.actor.uuid, effect.uuid]);
    await activeGM.query("auras.deleteAuraEffects", Object.fromEntries(actorEffectEntries));
  } else {
    // TODO: Maybe refactor this logic so that it can be utilized in the main updateToken function
    const { distance: radius, disposition, collisionTypes } = effect.system;
    if (!radius) return;
    const tokensInRange = getNearbyTokens(token, radius, { disposition, collisionTypes }).map(t => t.actor)
    const toAddTo = tokensInRange.filter(a => (a !== token.actor) && !a?.effects.find(e => e.origin === effect.uuid)).map(a => a?.uuid);
    const actorToEffectsMap = Object.fromEntries(toAddTo.map(actorUuid => [actorUuid, effect.uuid]));
    await activeGM.query("auras.applyAuraEffects", actorToEffectsMap);
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
  if (effect.type !== "auras.aura") return;
  if (!canvas.scene) return;
  const actor = (effect.parent instanceof Actor) ? effect.parent : effect.parent?.parent;
  if (!actor) return;
  const activeGM = game.users.activeGM;
  if (!activeGM) {
    if (!seenWarning) {
      ui.notifications.warn("AURAS.NoActiveGM", { localize: true });
      seenWarning = true;
    }
    return;
  }
  const actorEffectEntries = canvas.scene.tokens.filter(t => t.actor && t.actor !== actor).map(t => [t.actor.uuid, effect.uuid]);
  await activeGM.query("auras.deleteAuraEffects", Object.fromEntries(actorEffectEntries));
}

/**
 * Injects a checkbox to transform the effect into an "Aura Active Effect" when the AE Config sheet is rendered
 * @param {ActiveEffectConfig} app  The Active Effect Config sheet being rendered
 * @param {HTMLElement} html        The HTML Element
 */
function injectAuraCheckbox(app, html) {
  if (!["base", "auras.aura"].includes(app.document.type)) return;
  const element = new foundry.data.fields.BooleanField().toFormGroup({
    label: game.i18n.localize("AURAS.IsAura"),
    hint: game.i18n.localize("AURAS.IsAuraHint")
  }, {
    value: app.document.type === "auras.aura"
  });
  html.querySelector("[data-tab=details] > .form-group.statuses")?.before(element);
  element.addEventListener("change", () => {
    const currType = app.document.type;
    const updates = app._processFormData(null, app.form, new foundry.applications.ux.FormDataExtended(app.form));
    // Ensure changes are properly serialized into an array
    if (foundry.utils.getType(updates.changes) !== "Array") updates.changes = Object.values(updates.changes ?? {});
    if (currType === "auras.aura") {
      updates.type = app.document.getFlag("auras", "originalType") ?? "base";
      foundry.utils.setProperty(updates, "flags.-=auras", null);
    } else {
      updates.type = "auras.aura";
      foundry.utils.setProperty(updates, "flags.auras.originalType", currType);
    }
    updates["==system"] = app.document.system;
    return app.document.update(updates);
  })
}

function registerHooks() {
  // Effect application/removal-specific hooks
  Hooks.on("updateToken", updateToken);
  Hooks.on("renderActiveEffectConfig", injectAuraCheckbox);
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
  CONFIG.queries["auras.deleteEffects"] = deleteEffects;
  CONFIG.queries["auras.applyAuraEffects"] = applyAuraEffects;
  CONFIG.queries["auras.deleteAuraEffects"] = deleteAuraEffects;
}

function registerAuraType() {
  Object.assign(CONFIG.ActiveEffect.dataModels, {
    "auras.aura": AuraActiveEffectData
  });
  DocumentSheetConfig.registerSheet(ActiveEffect, "auras", AuraActiveEffectSheet, {
    label: "AURAS.SHEETS.AuraActiveEffectSheet",
    types: ["auras.aura"],
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

/*
TODOS:
- Handle "don't allow stacking" - maybe
    - System-specific, "take best"
*/

Hooks.once("ready", () => {
  overrideSheets();
});
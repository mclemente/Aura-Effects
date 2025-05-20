import { DISPOSITIONS } from "./constants.mjs";

export async function migrate() {
  const sortedMigrations = Object.entries(migrations).sort((a, b) => {
    return foundry.utils.isNewerVersion(b[0], a[0]) ? -1 : 1;
  });
  const migrationVersion = game.settings.get("ActiveAuras", "migrationVersion");
  let existingAlert;
  for (const [version, migration] of sortedMigrations) {
    if (!foundry.utils.isNewerVersion(version, migrationVersion)) continue;
    if (!existingAlert) existingAlert = ui.notifications.info("ACTIVEAURAS.Migrations.Beginning", { permanent: true, localize: true });
    await migration();
    await game.settings.set("ActiveAuras", "migrationVersion", version);
  }
  if (existingAlert) {
    existingAlert.remove();
    ui.notifications.success("ACTIVEAURAS.Migrations.AllCompleted", { localize: true });
  }
}
const migrations = {
  "1.0.0": async () => {
    const deprecatedSettings = {
      wallsBlock: game.settings.storage.get("world").find(s => s.key === "ActiveAuras.wall-block")?.value ? ["move"] : []
    }
    const allWorldActors = Object.values(game.actors.tokens).concat(Object.values(game.actors.contents));
    const allWorldItems = allWorldActors.flatMap(i => Object.values(i.items.contents)).concat(Object.values(game.items.contents));
    const allWorldParents = allWorldActors.concat(allWorldItems);
    const allCompendiumParents = (await Promise.all(
      game.packs.filter(p => ["Actor", "Item"].includes(p.metadata.type) && !p.locked)
                .map(p => p.getDocuments())
    )).flat();
    const allParents = allWorldParents.concat(allCompendiumParents);
    return Promise.all(allParents.map(document => {
      let allEffectDiffs = [];
      for (const effect of document.effects) {
        if (!effect.flags?.ActiveAuras) continue;
        allEffectDiffs.push(getMigratedEffectData(effect, deprecatedSettings));
      }
      return document.updateEmbeddedDocuments("ActiveEffect", allEffectDiffs);
    }));
  }
}

function getMigratedEffectData(oldEffect, deprecatedSettings) {
  const {
    // isAura -> become the new type
    isAura = false,
    // applied -> don't, but get `flags.ActiveAuras.fromAura`
    applied = false,
    // type -> see typeCheck based on system
    type = "",
    // customCheck -> will have to see what vars differ
    customCheck = "",
    // alignment -> if exists, assume 5e/sw5e and convert to script
    alignment = "",
    // radius -> system.distance
    radius = "0",
    // nameOverride -> system.overrideName
    nameOverride = "",
    // wallsBlock -> move to system.collisionTypes with movement ig
    wallsBlock = "system",
    // ignoreSelf -> system.applyToSelf
    ignoreSelf = false,
    // aura -> system.disposition
    aura = "All",
    // statuses -> move to statuses
    statuses = [],
    // wildcard -> move to customCheck
    wildcard = false,
    // extra -> move to customCheck
    extra = false,
    // hidden -> hmm (don't show/work while hidden)
    hidden = true,
    // displayTemp -> remove
    // height -> remove
    // hostile -> hmm (only go on turn of combatant)
    // onlyOnce -> remove
    // isMacro -> remove
    // time -> remove
    // Paused -> remove
  } = oldEffect.flags.ActiveAuras;
  const oldEffectData = oldEffect.toObject();
  const diffEffectData = {
    _id: oldEffect.id
  };
  diffEffectData.statuses = Array.from(new Set(oldEffectData.statuses.concat(statuses)));
  if (isAura) {
    let newCustomCheck = customCheck.trim()
      .replaceAll("sourceToken", "sourceTokenOld")
      .replaceAll("auraEntity", "sourceToken");
    let alreadyTouchedCheck = false;
    if (alignment) {
      alreadyTouchedCheck = true;
      if (newCustomCheck.length) {
        newCustomCheck = `(${newCustomCheck}) && `;
      }
      newCustomCheck += `(actor.system.details?.alignment?.toLowerCase().includes("${alignment.toLowerCase()}"))`;
    }
    if (type) {
      const allowedIds = ["dnd5e", "swade", "dnd4e"];
      if (allowedIds.includes(game.system.id)) {
        if (newCustomCheck.length) {
          if (!alreadyTouchedCheck) newCustomCheck = `(${newCustomCheck})`;
          newCustomCheck += " && ";
        }
        if (game.system.id === "dnd5e") {
          newCustomCheck += `(Object.values(actor.system.details.type).concat(actor.system.details.race?.name).some(type => "${type.toLowerCase()}".split(";").filter(t => t).includes(type?.toLowerCase())))`;
        } else if (game.system.id === "swade") {
          newCustomCheck += `("${type.toLowerCase()}".split(";").filter(t => t).includes(actor.system.details.species?.name?.toLowerCase()))`;
        } else if (game.system.id === "dnd4e") {
          newCustomCheck += `([actor.system.details.type, actor.system.details.other, actor.system.details.origin].some(type => "${type.toLowerCase}".split(";").filter(t => t).includes(type?.toLowerCase())))`;
        }
      }
    }
    if (game.system.id === "swade") {
      if ((!wildcard || !extra) && (wildcard !== extra)) {
        if (newCustomCheck.length) {
          if (!alreadyTouchedCheck) newCustomCheck = `(${newCustomCheck})`;
          newCustomCheck += " && ";
        }
        newCustomCheck += `(${wildcard ? "" : "!"}actor.isWildcard)`;
      }
    }
    diffEffectData.type = "ActiveAuras.aura";
    diffEffectData["==system"] = {
      applyToSelf: !ignoreSelf,
      collisionTypes: wallsBlock === "system"
        ? deprecatedSettings.wallsBlock
        : wallsBlock === "true"
          ? ["move"]
          : [],
      disableOnHidden: hidden,
      distance: Number(radius),
      disposition: aura === "All"
        ? DISPOSITIONS.ANY 
        : aura === "Allies"
          ? DISPOSITIONS.FRIENDLY
          : DISPOSITIONS.HOSTILE,
      overrideName: nameOverride,
      script: newCustomCheck,
    };
    diffEffectData["flags.-=ActiveAuras"] = null;
  } else if (applied) {
    diffEffectData["flags.==ActiveAuras"] = { fromAura: true };
  }
  return diffEffectData;
}
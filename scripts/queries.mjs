const gmQueue = new foundry.utils.Semaphore();

/**
 * Delete all Active Effects whose UUIDs are provided (ignoring any UUIDs which do NOT correspond to Active Effects)
 * @param {Object} data                 Query input data
 * @param {string[]} data.effectUuids   A list of UUIDs for each Active Effect that should be deleted 
 * @returns {Promise<boolean>}          true
 */
async function deleteEffects({ effectUuids }) {
  await gmQueue.add(() => {
    const effects = new Set(effectUuids.map(uuid => fromUuidSync(uuid))).filter(e => e instanceof ActiveEffect);
    return Promise.all(effects.map(e => e.delete()));
  });
  return true;
}

/**
 * Create potentially multiple Active Effects on potentially multiple Actors, modifying the provided effects as
 * necessary for "aura effect" treatment and skipping effects which already exist
 * @param {Object<string, string[]>} actorToEffectsMap  An object with Actor UUIDs as keys, and lists of ActiveEffect UUIDs as values
 * @returns {Promise<boolean>}                          true
 */
async function applyAuraEffects(actorToEffectsMap) {
  await gmQueue.add(() => {
    return Promise.all(Object.entries(actorToEffectsMap).map(([actorUuid, effectUuids]) => {
      const actor = fromUuidSync(actorUuid);
      const allEffects = actor.appliedEffects;
      const effects = effectUuids.map(uuid => {
        if (allEffects.some(e => e.origin === uuid)) return null;
        const effect = fromUuidSync(uuid);
        if (!effect) return null;
        const effectData = foundry.utils.mergeObject(effect.toObject(), {
          origin: uuid,
          type: effect.getFlag("auras", "originalType") ?? "base",
          transfer: false,
          "flags.auras.fromAura": true
        });
        if (game.modules.get("dae")?.active) {
          for (const change of effectData.changes) {
            change.value = Roll.replaceFormulaData(change.value, effect.parent?.getRollData?.());
            change.value = change.value.replaceAll("##", "@");
          }
        } else if (effect.system.evaluatePreApply) {
          for (const change of effectData.changes) {
            change.value = Roll.replaceFormulaData(change.value, effect.parent?.getRollData?.());
          }
        }
        return effectData;
      }).filter(e => e);
      return actor.createEmbeddedDocuments("ActiveEffect", effects);
    }));
  });
  return true;
}

/**
 * Delete potentially multiple aura-based Active Effects on potentially multiple Actors, using provided effects as 
 * "source" effects whose children should be deleted and skipping effects which don't exist
 * @param {Object<string, string[]>} actorToEffectsMap  An object with Actor UUIDs as keys, and lists of ActiveEffect UUIDs as values
 * @returns {Promise<boolean>}                          true
 */
async function deleteAuraEffects(actorToEffectsMap) {
  await gmQueue.add(() => {
    return Promise.all(Object.entries(actorToEffectsMap).map(([actorUuid, effectUuids]) => {
      const actor = fromUuidSync(actorUuid);
      const allEffects = actor.appliedEffects;
      const toDelete = allEffects.filter(e => effectUuids.includes(e.origin)).map(e => e.id);
      return actor.deleteEmbeddedDocuments("ActiveEffect", toDelete);
    }));
  });
  return true;
}

export {
  applyAuraEffects,
  deleteAuraEffects,
  deleteEffects
};
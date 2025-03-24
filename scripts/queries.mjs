const gmQueue = new foundry.utils.Semaphore();

/**
 * Create an Active Effect (from the provided effect data) on each Actor (from the provided Actor UUIDs) 
 * @param {Object} data                 Query input data
 * @param {Object} data.effectData      The Active Effect, as an object, to be added to each Actor
 * @param {string[]} data.actorUuids    A list of UUIDs for each Actor that the effect should be added to
 * @returns {Promise<boolean>}          true
 */
async function applyEffect({effectData, actorUuids}) {
    await gmQueue.add(() => {
        const targetActors = new Set(actorUuids.map(uuid => fromUuidSync(uuid)));
        return Promise.all(targetActors.map(actor => actor.createEmbeddedDocuments("ActiveEffect", [effectData])));
    });
    return true;
}

/**
 * Delete all Active Effects whose UUIDs are provided (ignoring any UUIDs which do NOT correspond to Active Effects)
 * @param {Object} data                 Query input data
 * @param {string[]} data.effectUuids   A list of UUIDs for each Active Effect that should be deleted 
 * @returns {Promise<boolean>}          true
 */
async function deleteEffects({effectUuids}) {
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
                return foundry.utils.mergeObject(effect.toObject(), {
                    origin: effect.origin ?? uuid,
                    type: effect.getFlag("auras", "originalType") ?? "base"
                });
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
    applyEffect,
    deleteAuraEffects,
    deleteEffects
};
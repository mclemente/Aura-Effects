import { DISPOSITIONS } from "./constants.mjs";

const { NumberField, SetField, StringField } = foundry.data.fields;

export default class AuraActiveEffectData extends foundry.abstract.TypeDataModel {
    static LOCALIZATION_PREFIXES = ["AURAS.ACTIVEEFFECT.Aura"];
    static defineSchema() {
        return {
            collisionTypes: new SetField(new StringField({
                choices: {
                    light: "WALL.FIELDS.light.label",
                    move: "WALL.FIELDS.move.label",
                    sight: "WALL.FIELDS.sight.label",
                    sound: "WALL.FIELDS.sound.label"
                },
                required: true,
                blank: false
            }), {
                initial: ["move"],
            }),
            distance: new NumberField({
                initial: 0,
                min: 0
            }),
            disposition: new NumberField({
                initial: DISPOSITIONS.ANY,
                choices: {
                    [DISPOSITIONS.HOSTILE]: "AURAS.ACTIVEEFFECT.Aura.FIELDS.disposition.Choices.Hostile",
                    [DISPOSITIONS.ANY]: "AURAS.ACTIVEEFFECT.Aura.FIELDS.disposition.Choices.Any",
                    [DISPOSITIONS.FRIENDLY]: "AURAS.ACTIVEEFFECT.Aura.FIELDS.disposition.Choices.Friendly"
                }
            })
        }
    }
}
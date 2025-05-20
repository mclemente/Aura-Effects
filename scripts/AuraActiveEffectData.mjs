import { DISPOSITIONS } from "./constants.mjs";

const { BooleanField, ColorField, JavaScriptField, NumberField, SetField, StringField } = foundry.data.fields;

export default class AuraActiveEffectData extends foundry.abstract.TypeDataModel {
  static LOCALIZATION_PREFIXES = ["AURAEFFECTS.ACTIVEEFFECT.Aura"];
  static defineSchema() {
    return {
      applyToSelf: new BooleanField({ initial: true }),
      bestFormula: new StringField({ initial: "" }),
      canStack: new BooleanField({ initial: false }),
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
      color: new ColorField(),
      combatOnly: new BooleanField({ initial: false }),
      disableOnHidden: new BooleanField({ initial: true }),
      distanceFormula: new StringField({ initial: "0" }),
      disposition: new NumberField({
        initial: DISPOSITIONS.ANY,
        choices: {
          [DISPOSITIONS.HOSTILE]: "AURAEFFECTS.ACTIVEEFFECT.Aura.FIELDS.disposition.Choices.Hostile",
          [DISPOSITIONS.ANY]: "AURAEFFECTS.ACTIVEEFFECT.Aura.FIELDS.disposition.Choices.Any",
          [DISPOSITIONS.FRIENDLY]: "AURAEFFECTS.ACTIVEEFFECT.Aura.FIELDS.disposition.Choices.Friendly"
        }
      }),
      evaluatePreApply: new BooleanField({ initial: false }),
      opacity: new NumberField({
        min: 0,
        max: 1,
        step: 0.05,
        initial: 0.25
      }),
      overrideName: new StringField({ initial: '' }),
      script: new JavaScriptField(),
      showRadius: new BooleanField({ initial: false })
    }
  }

  get isSuppressed() {
    if (this.combatOnly && !game.combat?.active) return true;
    if (this.disableOnHidden) {
      let actor = this.parent.parent;
      if (actor instanceof Item) actor = actor.actor;
      if (actor?.getActiveTokens(false, true)[0]?.hidden) return true;
    }
    return false;
  }

  get distance() {
    return new Roll(this.distanceFormula || "0", this.parent.parent?.getRollData?.()).evaluateSync({ strict: false }).total;
  }

  prepareDerivedData() {
    if (!this.applyToSelf) {
      this.parent.changes = [];
      this.parent.statuses = new Set();
    }
    if (!this.canStack) {
      let actor = this.parent.parent;
      if (actor instanceof Item) actor = actor.actor;
      const nameMatch = this.overrideName || this.parent.name;
      const existing = actor?.appliedEffects.find(e => e.flags?.auraeffects?.fromAura && e.name === nameMatch);
      if (existing) {
        this.parent.changes = [];
        this.parent.statuses = new Set();
      }
    }
  }
}
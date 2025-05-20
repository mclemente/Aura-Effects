import { getExtendedParts, getExtendedTabs } from "./helpers.mjs";

export default class AuraActiveEffectSheet extends foundry.applications.sheets.ActiveEffectConfig {
  static PARTS = getExtendedParts(super.PARTS);

  static TABS = getExtendedTabs(super.TABS);

  static DEFAULT_OPTIONS = {
    actions: {
      revert: AuraActiveEffectSheet.#onRevert
    }
  };

  async _preparePartContext(id, context) {
    context = await super._preparePartContext(id, context);
    if (id === "aura") {
      context = foundry.utils.mergeObject(context, {
        fields: this.document.system.schema.fields
      }, { inplace: false });
    }
    return context;
  };

  static #onRevert() {
    const updates = this._processFormData(null, this.form, new foundry.applications.ux.FormDataExtended(this.form));
    if (foundry.utils.getType(updates.changes) !== "Array") updates.changes = Object.values(updates.changes ?? {});
    updates.type = this.document.getFlag("ActiveAuras", "originalType") ?? "base";
    foundry.utils.setProperty(updates, "flags.-=ActiveAuras", null);
    updates["==system"] = {};
    this.document.update(updates);
  }
}
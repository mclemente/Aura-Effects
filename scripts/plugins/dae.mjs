import { getExtendedParts, getExtendedTabs } from "../helpers.mjs";
export default function replaceDAESheet() {
  if (!game.modules.get("dae")?.active) return;
  const { cls: DAEConfig, label, default: makeDefault } = CONFIG.ActiveEffect.sheetClasses.base["core.DAEActiveEffectConfig"];
  foundry.applications.apps.DocumentSheetConfig.unregisterSheet(ActiveEffect, "core", DAEConfig, { types: ["ActiveAuras.aura"] });
  class AuraDAESheet extends DAEConfig {
    static PARTS = getExtendedParts(super.PARTS);

    static TABS = getExtendedTabs(super.TABS);

    static DEFAULT_OPTIONS = {
      actions: {
        revert: AuraDAESheet.#onRevert
      }
    };

    async _preparePartContext(id, context) {
      context = await super._preparePartContext(id, context);
      if (id === "aura") {
        context = foundry.utils.mergeObject(context, {
          fields: this.document.system.schema.fields,
          isDAEEnabled: true
        }, { inplace: false });
      }
      return context;
    }

    static #onRevert() {
      const updates = this._processFormData(null, this.form, new foundry.applications.ux.FormDataExtended(this.form));
      if (foundry.utils.getType(updates.changes) !== "Array") updates.changes = Object.values(updates.changes ?? {});
      updates.type = this.document.getFlag("ActiveAuras", "originalType") ?? "base";
      foundry.utils.setProperty(updates, "flags.-=ActiveAuras", null);
      updates["==system"] = {};
      this.document.update(updates);
    }
  }
  
  foundry.applications.apps.DocumentSheetConfig.registerSheet(ActiveEffect, "ActiveAuras", AuraDAESheet, {
    label,
    types: ["ActiveAuras.aura"],
    makeDefault
  });
}
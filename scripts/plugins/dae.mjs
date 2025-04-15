import { getExtendedParts, getExtendedTabs } from "../helpers.mjs";
export default function replaceDAESheet() {
  if (!game.modules.get("dae")?.active) return;
  const { cls: DAEConfig, label, default: makeDefault } = CONFIG.ActiveEffect.sheetClasses.base["core.DAEActiveEffectConfig"];
  DocumentSheetConfig.unregisterSheet(ActiveEffect, "core", DAEConfig, { types: ["auras.aura"] });
  class AuraDAESheet extends DAEConfig {
    static PARTS = getExtendedParts(super.PARTS);

    static TABS = getExtendedTabs(super.TABS);

    async _preparePartContext(id, context) {
      context = await super._preparePartContext(id, context);
      if (id === "aura") {
        context = foundry.utils.mergeObject(context, {
          fields: this.document.system.schema.fields
        }, { inplace: false });
      }
      return context;
    }
  }
  DocumentSheetConfig.registerSheet(ActiveEffect, "auras", AuraDAESheet, {
    label,
    types: ["auras.aura"],
    makeDefault
  });
}
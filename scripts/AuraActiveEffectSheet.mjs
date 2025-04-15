import { getExtendedParts, getExtendedTabs } from "./helpers.mjs";

export default class AuraActiveEffectSheet extends foundry.applications.sheets.ActiveEffectConfig {
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
  };
}
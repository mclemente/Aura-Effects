export default class AuraActiveEffectSheet extends foundry.applications.sheets.ActiveEffectConfig {
    static PARTS = Object.fromEntries(Object.entries(super.PARTS).toSpliced(-1, 0, ["aura", { template: "modules/auras/templates/auraConfig.hbs" }]))

    static TABS = {
        sheet: {
            ...super.TABS.sheet,
            tabs: [
                ...super.TABS.sheet.tabs,
                { id: "aura", icon: "fa-solid fa-person-rays" }
            ]
        }
    }

    async _prepareContext(options) {
        const context = foundry.utils.mergeObject(await super._prepareContext(options), {
            fields: this.document.system.schema.fields
        }, { inplace: false });
        return context;
    }
}
export function registerSettings() {
    game.settings.register("auras", "disableVisuals", {
        name: "AURAS.SETTINGS.DisableVisuals.Name",
        hint: "AURAS.SETTINGS.DisableVisuals.Hint",
        scope: "client",
        config: true,
        type: Boolean,
        default: false
    });
    game.settings.register("auras", "exactCircles", {
        name: "AURAS.SETTINGS.ExactCircles.Name",
        hint: "AURAS.SETTINGS.ExactCircles.Hint",
        scope: "client",
        config: true,
        type: Boolean,
        default: false
    });
}
import { updateAllVisualizations } from "./auraVisualization.mjs";

export function registerSettings() {
  game.settings.register("ActiveAuras", "disableVisuals", {
    name: "ACTIVEAURAS.SETTINGS.DisableVisuals.Name",
    hint: "ACTIVEAURAS.SETTINGS.DisableVisuals.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    onChange: () => {
      if (canvas?.ready) updateAllVisualizations();
    }
  });
  game.settings.register("ActiveAuras", "exactCircles", {
    name: "ACTIVEAURAS.SETTINGS.ExactCircles.Name",
    hint: "ACTIVEAURAS.SETTINGS.ExactCircles.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    onChange: () => {
      if (canvas?.ready) updateAllVisualizations();
    }
  });
  game.settings.register("ActiveAuras", "disableScrollingText", {
    name: "ACTIVEAURAS.SETTINGS.DisableScrollingText.Name",
    hint: "ACTIVEAURAS.SETTINGS.DisableScrollingText.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });
  game.settings.register("ActiveAuras", "migrationVersion", {
    name: "Migration Version",
    hint: "Tracks the last completed migration. Please do not touch this.",
    scope: "world",
    config: false,
    type: String,
    default: "0.0.0"
  });
}
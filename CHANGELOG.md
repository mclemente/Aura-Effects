# Aura Effects Changelog

## Version 1.0.0
- Welcome to those coming from Active Auras. There is an included migration script (user-triggered, found in the Aura Effects Macros compendium) which aims to automatically convert effects to the new format. Key differences from Active Auras:
  - Auras can now be visualized! This can be disabled globally per-client, and enabled/disabled per-Aura as well.
  - Auras will now always respect whatever grid diagonal settings are selected, and will compute vertical distance using the same rules.
  - You can now select to _not_ evaluate effect change values pre-application (unless you are using a module such as DAE, which forces that behavior). This means you can have an aura grant, for instance, a bonus to each recipient's attacks equal to _the recipient's_ strength score.
  - Aura source effects are now a new subtype of Active Effects. You can turn an Active Effect into an Aura Active Effect on the "Details" tab of the effect configuration. This will re-open the window with a new "Aura" tab.
  - Support for Templates & Drawings calling macros has been dropped; with the existence of Scene Regions, this functionality should no longer be necessary.
  - System-specific options (such as alignment for dnd5e and wildcard/extra for swade) have been dropped. If you used these, the migration script should pick this up and populate the "Conditional Script" field with the appropriate implementation of what you had selected.
  - Combat-only auras are now per-aura, rather than a global setting. Performance, in general, should be greatly enhanced.
  - Custom evaluation (conditional script) has undergone two minor changes: `system` is no longer in the scope (simply use `actor.system` instead), and `auraEntity` has been renamed to `sourceToken`. The latter renaming should be automatically handled via migration script.
- Added no-stacking & best formula fields, along with logic for ensuring only the "best" aura applies
- Added combat-only and disable on hidden fields
- Added a name override so that the applied effect can have a different name from the source effect
- Added a compendium of Macros (currently, only contains the migration script from Active Auras to Aura Effects)

## Version 0.6.1
- Auras tab is now scrollable

## Version 0.6.0
- Added "Evaluate Changes Early" field
- Ensured (or attempted to ensure) that DAE's rules for value replacement are adhered to, if active

## Version 0.5.0
- Added "Conditional Script" field
- Moved "Is Aura" checkbox

## Version 0.4.0
- Majorly overhauled visualization logic to instead use Point Effect Sources
- "Better" apply-to-self logic, which should work properly now
- Modified token-to-token distance calc on gridless to take external radius of source into account

## Version 0.3.0
- Added the beginning of plugin behavior (so far just compatibility with DAE's custom sheet)
- Setting for showing circles on gridded maps with "Exact" set as diagonal distances
- Settings for whether an aura should apply to self or not
- Added logic for the above - depends on a V13 issue being addressed
- Added logic for effects being enabled/disabled, deleted, and to ensure old effects (from no-longer-active/existent auras) are properly wiped on token movement
- Ensure auras are drawn _under_ any existing drawings

## Version 0.2.0
- Added aura visualization
- Added changelog

## Version 0.1.0
- Initial commit
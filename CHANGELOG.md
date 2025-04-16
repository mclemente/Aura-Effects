# Auras Changelog

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
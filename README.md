# Auras
## Summary
A module that lets Active Effects to be configured as "Auras," automatically applying to tokens within a configured range, and optionally showing a visualization of the aura.

## Technical Details
Distance is calculated differently depending on whether the scene is gridless or gridded. If gridless, it is center-to-center, minus the external radius (generally, half width) of the "source" token. If gridded, it uses whichever diagonal measurement rules have been set in core settings and calculates the closest distance between two tokens based on which grid spaces they occupy (this means that a 2x2 token on a square grid, for instance, will compute the distance from the center of each of its 4 occupied squares to another token, and use the smallest value when determining whether the aura should apply).

When visualizing the auras on a gridded scene, tokens larger than 1x1 may have _visual_ bounds that don't line up exactly with the actual computed distances. This is more likely to happen on larger-radius auras, and is a consequence of avoiding excessive calculations each time a token is refreshed.

Set "Collision Types" refer to the types of wall which will block an aura. By default, auras are blocked by walls which block movement (as reflected by the default value for that field).

Disposition is largely as-expected: Hostile applies only to tokens whose disposition is opposite that of the source token (note: will still apply to self unless that setting is unchecked). Friendly applies only to tokens whose disposition matches that of the source token. "Any" applies to tokens regardless of disposition. Worth noting, a "Neutral" disposition token will _never_ be considered Friendly or Hostile, nor will a "Secret" disposition token. Both will still be considered valid recipients of an "Any"-disposition aura.
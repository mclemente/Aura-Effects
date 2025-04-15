/**
 * Get 3D distance in grid units, returning Infinity if any provided collision types would block the ray
 * @param {Scene} scene                         The scene to measure on
 * @param {ElevatedPoint} a                     First Point
 * @param {ElevatedPoint} b                     Second Point
 * @param {Object} options                      Additional options
 * @param {string[]} options.collisionTypes     Which collision types should result in infinite distance
 * @returns {number}                            The distance
 */
function getDistance(scene, a, b, { collisionTypes }) {
  for (const collisionType of collisionTypes) {
    if (CONFIG.Canvas.polygonBackends[collisionType]?.testCollision(a, b, {
      type: collisionType,
      mode: "any"
    })) return Infinity;
  }
  return scene.grid.measurePath([a, b]).distance;
}

/**
 * Get minimum 3D distance from one token to another
 * @param {TokenDocument} tokenA                First Token
 * @param {TokenDocument} tokenB                Second Token
 * @param {Object} options                      Additional options
 * @param {string[]} options.collisionTypes     Which collision types should result in Infinity distance
 * @returns {number}                            The minimum distance
 */
function getTokenToTokenDistance(tokenA, tokenB, { collisionTypes = [] }) {
  const scene = tokenA.parent;
  // TODO: Similar lenience with gridless as gridded?
  const tokenAOffsets = scene.grid.isGridless
    ? [tokenA.getCenterPoint()]
    : tokenA.getOccupiedGridSpaceOffsets();
  const tokenBOffsets = scene.grid.isGridless
    ? [tokenB.getCenterPoint()]
    : tokenB.getOccupiedGridSpaceOffsets();
  // TODO: Perhaps proper elevation ranges
  const tokenAElevation = tokenA.elevation ?? 0;
  const tokenBElevation = tokenB.elevation ?? 0;
  // TODO: Maybe filter down comparisons instead of full 2D array
  const distances = [];
  for (const offsetA of tokenAOffsets) {
    for (const offsetB of tokenBOffsets) {
      const pointA = { ...scene.grid.getCenterPoint(offsetA), elevation: tokenAElevation };
      const pointB = { ...scene.grid.getCenterPoint(offsetB), elevation: tokenBElevation };
      distances.push(getDistance(scene, pointA, pointB, { collisionTypes }));
    }
  }
  const externalAdjust = (scene.grid.distance / scene.grid.size) * (scene.grid.isGridless
    ? tokenA.object.externalRadius
    : 0);
  return Math.min(...distances) - externalAdjust;
}

/**
 * Get a putative set of Tokens which MAY be within the specified radius of the source token
 * @param {TokenDocument} sourceToken   The source token from which to measure
 * @param {number} radius               The radius of the grid-based circle to estimate
 * @returns {Set<Token>}                A set of Tokens which MAY be within range (necessarily containing the subset of Tokens which ARE within range)
 */
function getGenerallyWithin(sourceToken, radius) {
  const adjustedRadius = sourceToken.parent.grid.size * ((radius / sourceToken.parent.grid.distance) + sourceToken.width / 2);
  const center = sourceToken.object.center;
  const rect = new PIXI.Rectangle(center.x - adjustedRadius, center.y - adjustedRadius, 2 * adjustedRadius, 2 * adjustedRadius);
  return sourceToken.layer.quadtree.getObjects(rect);
}

/**
 * Get all tokens within a certain range of the source token
 * @param {TokenDocument} source                The source token from which to measure
 * @param {number} radius                       The radius of the grid-based circle to measure
 * @param {Object} options                      Additional options
 * @param {-1|0|1} options.disposition          The relative disposition of token that should be considered (-1 for hostile, 0 for all, 1 for friendly)
 * @param {string[]} options.collisionTypes     Which collision types should result in Infinity distance
 * @returns {TokenDocument[]}       The TokenDocuments within range
 */
function getNearbyTokens(source, radius, { disposition = 0, collisionTypes }) {
  const putativeTokens = Array.from(getGenerallyWithin(source, radius))
    .map(t => t.document)
    .filter(t => {
      if (disposition < 0) return (source.disposition * t.disposition) === -1;
      if (disposition > 0) return (source.disposition === t.disposition);
      return true;
    });
  return putativeTokens.filter(token => getTokenToTokenDistance(source, token, { collisionTypes }) <= radius);
}

/**
 * Determine whether a token has no further movement queued (or the game has been paused mid-movement)
 * @param {TokenDocument} token     The token to check
 * @returns {boolean}               true if final movement is complete, else false
 */
function isFinalMovementComplete(token) {
  return (token.movement.state === "stopped") || (
    !token.movement.pending?.distance
    && token.movement.destination.x === token.x
    && token.movement.destination.y === token.y
    && token.movement.destination.elevation === token.elevation
  );
}

/**
 * Get all "source" aura effects on a given actor, split into inactive & active
 * @param {Actor} actor                         The actor to check
 * @returns {[ActiveEffect[], ActiveEffect[]]}  The Arrays of aura effects (active, then inactive)
 */
function getAllAuraEffects(actor) {
  const activeAuras = [];
  const inactiveAuras = [];
  for (const effect of actor.allApplicableEffects()) {
    if (effect.type !== "auras.aura") continue;
    if (!effect.disabled && !effect.isSuppressed) activeAuras.push(effect);
    else inactiveAuras.push(effect);
  }
  return [activeAuras, inactiveAuras];
}

/**
 * Insert the new "aura" tab's Handlebars template part into an existing object of PARTS, for use when
 * extending an existing AE Config Sheet
 * @param {Record<string, HandlebarsTemplatePart} origParts     The application's original PARTS
 * @returns {Record<string, HandlebarsTemplatePart>}            The extended PARTS
 */
function getExtendedParts(origParts) {
  return Object.fromEntries(Object.entries(origParts).toSpliced(-1, 0, ["aura", { template: "modules/auras/templates/auraConfig.hbs" }]));
}

/**
 * Add the new "aura" tab to an existing TABS object, for use when extending an existing AE Config Sheet
 * @param {Record<string, ApplicationTabsConfiguration>} origTabs   The application's original TABS
 * @returns {Record <string, ApplicationTabsConfiguration>}         The extended TABS
 */
function getExtendedTabs(origTabs) {
  return {
    sheet: {
      ...origTabs.sheet,
      tabs: [
        ...origTabs.sheet.tabs,
        { id: "aura", icon: "fa-solid fa-person-rays" }
      ]
    }
  };
}

export {
  getNearbyTokens,
  getTokenToTokenDistance,
  isFinalMovementComplete,
  getAllAuraEffects,
  getExtendedParts,
  getExtendedTabs
};
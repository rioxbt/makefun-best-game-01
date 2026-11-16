// A small seeded generator (xorshift32): the same seed gives the same game, which is what makes
// the screenshot scenes and the wave plans repeatable. It is not a good generator for anything
// secret; it only has to be cheap, uniform enough to scatter volleys, and deterministic.

export function createRandom(seed) {
  // Any seed is folded into a non-zero 32-bit state, since xorshift never leaves zero.
  let state = (seed >>> 0) || 0x9e3779b9;
  return function random() {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

/** A random value in [min, max). */
export function between(random, min, max) {
  return min + random() * (max - min);
}

/** The shortest signed distance from angle a to angle b, in (-PI, PI]. */
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

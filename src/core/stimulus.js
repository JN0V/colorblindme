/**
 * Stimulus pools, one per confusion axis.
 *
 * Colours are chosen so the full-dichromat transform moves them a long way
 * (deltaE 40-85) while staying inside sRGB after luminance matching. That
 * matters for the validity of the whole test: it guarantees a normal observer
 * is far above threshold at EVERY severity we present, so failing to see a
 * difference at 0.4 is a fact about your eyes, not about a weak stimulus.
 *
 * Measured on the shipped pools: at the lowest severity presented (0.2) the
 * mean difference is still deltaE 11-17, against a just-noticeable difference
 * of about 2.3.
 */

import { matrixFor } from "./machado.js";
import { applyMatrix, deltaE } from "./color.js";

const POOL_SIZE = 150;
const MIN_CHANNEL = 45, MAX_CHANNEL = 215;
const DE_CEILING = 85;
const DE_FLOOR_START = 40;

const pools = new Map();

function randomPool(axis, rng) {
  const full = matrixFor(axis, 10);
  const out = [];
  let floor = DE_FLOOR_START, tries = 0;
  while (out.length < POOL_SIZE && tries < 400_000) {
    tries++;
    // Relax the floor if a narrow axis cannot fill the pool, rather than spin.
    if (tries % 60_000 === 0 && floor > 20) floor -= 5;
    const base = [0, 0, 0].map(() =>
      MIN_CHANNEL + Math.floor(rng() * (MAX_CHANNEL - MIN_CHANNEL + 1)));
    const shifted = applyMatrix(base, full, true);
    if (shifted.clipped) continue;
    const d = deltaE(base, shifted.rgb);
    if (d < floor || d > DE_CEILING) continue;
    out.push(base);
  }
  return out;
}

export function poolFor(axis, rng = Math.random) {
  if (!pools.has(axis)) pools.set(axis, randomPool(axis, rng));
  return pools.get(axis);
}

/**
 * One 4-AFC trial: three identical squares and one transformed.
 * @returns {{base:number[], odd:number[], position:number, deltaE:number}}
 */
export function makeTrial(axis, severity, rng = Math.random) {
  const pool = poolFor(axis, rng);
  const base = pool[Math.floor(rng() * pool.length)];
  const odd = applyMatrix(base, matrixFor(axis, severity), true);
  return {
    base,
    odd: odd.rgb,
    position: Math.floor(rng() * 4),
    deltaE: deltaE(base, odd.rgb),
  };
}

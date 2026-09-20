/**
 * Protan / deutan discrimination by luminous efficiency.
 *
 * The chromatic staircase in staircase.js deliberately matches the luminance
 * of every stimulus, so that the observer answers on colour rather than on
 * brightness. That is correct for measuring SEVERITY and wrong for
 * identifying the AXIS, because luminance is exactly what separates protan
 * from deutan:
 *
 *   - a saturated red reaches a protanope at roughly 15% of the lightness it
 *     has for a typical observer; red at luminance 0.168 falls to 0.088;
 *   - for a deuteranope the same red RISES to 0.211, and mean lightness across
 *     red-green mixtures is indistinguishable from typical;
 *   - hence protans confuse red with black and deutans do not.
 *
 * Protan and deutan confusion lines are close enough that a short chromatic
 * screening cannot reliably separate them — it was measured picking the wrong
 * axis in practice. So the axis is decided here first, on luminance, and only
 * then does the chromatic pass measure severity.
 *
 * Method: a red and a green carrying IDENTICAL physical luminance are each
 * matched against a neutral grey by a 1-up-1-down staircase (which converges
 * on the point of subjective equality, unlike the 2-down-1-up used for
 * detection thresholds). The RATIO of the two matches is the statistic: it
 * cancels display brightness, gamma and calibration, since both measurements
 * suffer them identically.
 *
 * Caveats, stated because the number looks harder than it is: the
 * Helmholtz-Kohlrausch effect makes saturated colours look lighter than their
 * luminance for everyone, so the typical ratio is not exactly 1.00; and this
 * separates protan from "normal luminous efficiency", which covers both
 * deutan and typical vision. It rules protan out; it does not rule deutan in.
 */

/** Pure red, and green scaled in linear light to the same luminance (Y = 0.2126). */
export const STIMULI = {
  red:   [255, 0, 0],
  green: [0, 148, 0],
};

/** Grey ladder: 21 log-spaced luminances. For a neutral grey, Y is the linear value. */
export const LADDER = { steps: 21, low: 0.02, high: 0.62 };
export const luminanceAt = i => {
  const t = Math.max(0, Math.min(LADDER.steps - 1, i)) / (LADDER.steps - 1);
  return LADDER.low * Math.pow(LADDER.high / LADDER.low, t);
};

export const CONFIG = {
  REVERSALS: 6,
  MAX_TRIALS: 22,
  BIG_STEP: 3,
  AVERAGE_LAST: 4,
  PROTAN_BELOW: 0.65,   // indicative, not clinical
  NORMAL_ABOVE: 0.85,
};

class MatchRun {
  constructor(rng = Math.random) {
    // A random start kills the anchoring you get from always beginning dark.
    this.i = 6 + Math.floor(rng() * 9);
    this.dir = 0; this.step = CONFIG.BIG_STEP; this.reversals = []; this.trials = 0;
  }
  get done() {
    return this.reversals.length >= CONFIG.REVERSALS || this.trials >= CONFIG.MAX_TRIALS;
  }
  #reversal() {
    this.reversals.push(this.i);
    if (this.reversals.length === 2) this.step = 2;
    if (this.reversals.length === 4) this.step = 1;
  }
  /** @param {boolean} greyLighter did the grey patch look lighter than the colour? */
  record(greyLighter) {
    this.trials++;
    const delta = greyLighter ? -this.step : this.step;
    const dir = Math.sign(delta);
    if (this.dir && dir !== this.dir) this.#reversal();
    this.dir = dir;
    this.i = Math.max(0, Math.min(LADDER.steps - 1, this.i + delta));
  }
  /**
   * "They look the same" is not a refusal to answer: it IS the point of
   * subjective equality, so it counts as a reversal here and the run then
   * samples around it.
   */
  recordMatch() {
    this.trials++;
    this.#reversal();
    this.dir = -this.dir || 1;
    this.i = Math.max(0, Math.min(LADDER.steps - 1,
      this.i + this.dir * Math.max(1, this.step - 1)));
  }
  estimate() {
    const use = this.reversals.slice(-CONFIG.AVERAGE_LAST);
    const idx = use.length ? use.reduce((a, b) => a + b, 0) / use.length : this.i;
    return luminanceAt(idx);
  }
}

export class LuminanceSession {
  constructor(rng = Math.random) {
    this.rng = rng;
    this.runs = { red: new MatchRun(rng), green: new MatchRun(rng) };
    this.total = 0;
  }
  /** @returns {{colour:"red"|"green", rgb:number[], greyLuminance:number}|null} */
  next() {
    const live = Object.entries(this.runs).filter(([, r]) => !r.done);
    if (!live.length) return null;
    const [colour, run] = live[Math.floor(this.rng() * live.length)];
    return { colour, rgb: STIMULI[colour], greyLuminance: luminanceAt(run.i) };
  }
  record(colour, answer) {
    const run = this.runs[colour];
    if (!run) throw new RangeError(`unknown stimulus: ${colour}`);
    if (answer === "same") run.recordMatch();
    else run.record(answer === "grey");
    this.total++;
  }
  result() {
    const red = this.runs.red.estimate();
    const green = this.runs.green.estimate();
    const ratio = red / green;
    const axis = ratio < CONFIG.PROTAN_BELOW ? "prot"
               : ratio >= CONFIG.NORMAL_ABOVE ? "deut"
               : null;   // undecided: fall back to the chromatic screening
    return {
      ratio, red, green, axis,
      confident: axis !== null,
      trials: this.total,
      reversals: { red: this.runs.red.reversals.length, green: this.runs.green.reversals.length },
    };
  }
}

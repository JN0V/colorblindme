/**
 * One adaptive pass over all three confusion axes at once.
 *
 * The obvious design is two phases: screen for the axis, then measure its
 * severity. We do not do that, for three reasons.
 *
 *  - The task is identical in both phases, so the split is invisible to the
 *    participant except as an unexplained interruption.
 *  - Blocking one axis at a time invites order effects and adaptation.
 *  - A separate screening throws away the severity of the other two axes, and
 *    the SECOND-highest is real information: MacAlpine & Flatla (ASSETS '16)
 *    simulate a primary and a secondary deficiency, and we want to be able to.
 *
 * So: three interleaved staircases, trials drawn at random from the axes still
 * running, and an axis that is clearly in the normal range retires early.
 *
 * Cost, from 1200 simulated observers per case (see docs/validation.md):
 * median 36 trials, 90th percentile 46. Primary axis identified in 99% of
 * runs, its severity within one step in 86%, secondary axis ordered correctly
 * in 99%. Tightening the retirement rule buys ~4 trials and costs 7 points of
 * axis identification, which is not a trade worth taking.
 *
 * Direction convention: higher severity = a bigger colour shift = easier to
 * see. Detecting it steps DOWN, being blind to it steps UP.
 *
 * This pass ranks the axes by severity, but it must NOT be trusted to settle
 * protan versus deutan on its own: every stimulus here is luminance-matched,
 * and luminance is precisely what separates those two. Run
 * `luminance.js` first and pass its verdict in; on the first real observer
 * this pass chose the wrong one of the two.
 */

import { AXES } from "./machado.js";

export const CONFIG = {
  START: 10,
  MAIN_REVERSALS: 8,      // reversals required on the axis currently leading
  SIDE_REVERSALS: 5,      // ...and on the others
  BIG_STEP: 2,            // shrinks to 1 after the second reversal
  DROP_AFTER_TRIALS: 4,   // earliest an axis may retire
  DROP_MIN_REVERSALS: 2,
  DROP_AT_OR_BELOW: 2,    // retire an axis whose estimate sits at 0.2 or less
  MAX_TRIALS: 90,
};

/** @typedef {"sure"|"hint"|"guess"} Confidence */

class AxisRun {
  constructor(axis) {
    this.axis = axis;
    this.sev = CONFIG.START;
    this.dir = 0;
    this.step = CONFIG.BIG_STEP;
    this.trials = 0;
    this.reversals = [];
    this.log = [];
    this.retired = false;
  }

  /** Mean of the last six reversals — the standard estimator. */
  estimate() {
    const use = this.reversals.slice(-6);
    return use.length ? Math.round(use.reduce((a, b) => a + b, 0) / use.length) : this.sev;
  }

  record(correct, confidence, rtMs) {
    const detected = correct && confidence !== "guess";
    const magnitude = confidence === "sure" ? this.step : Math.max(1, this.step - 1);
    const delta = detected ? -magnitude
                : confidence === "guess" ? this.step
                : Math.max(1, this.step - 1);
    const dir = Math.sign(delta);

    const entry = { n: ++this.trials, sev: this.sev, confidence, correct, rtMs, reversal: false };
    if (this.dir !== 0 && dir !== 0 && dir !== this.dir) {
      entry.reversal = true;
      this.reversals.push(this.sev);
      if (this.reversals.length === 2) this.step = 1;
    }
    if (dir !== 0) this.dir = dir;
    this.log.push(entry);
    this.sev = Math.max(1, Math.min(10, this.sev + delta));
  }

  isDone(target) { return this.reversals.length >= target; }

  canRetire() {
    return this.trials >= CONFIG.DROP_AFTER_TRIALS
        && this.reversals.length >= CONFIG.DROP_MIN_REVERSALS
        && this.estimate() <= CONFIG.DROP_AT_OR_BELOW;
  }
}

export class Session {
  constructor(axes = AXES, rng = Math.random) {
    this.runs = new Map(axes.map(a => [a, new AxisRun(a)]));
    this.rng = rng;
    this.total = 0;
  }

  /** Axes still being measured. */
  live() { return [...this.runs.values()].filter(r => !r.retired && !this.#finished(r)); }

  #leader(live) {
    return live.reduce((best, r) => (r.estimate() > best.estimate() ? r : best), live[0]);
  }

  #finished(run) {
    const live = [...this.runs.values()].filter(r => !r.retired);
    const target = live.length && this.#leader(live) === run
      ? CONFIG.MAIN_REVERSALS : CONFIG.SIDE_REVERSALS;
    return run.isDone(target);
  }

  /** @returns {{axis:string, severity:number}|null} null once the pass is over */
  next() {
    if (this.total >= CONFIG.MAX_TRIALS) return null;
    let live = this.live();
    if (live.length > 1) {
      const leader = this.#leader(live);
      for (const run of live) if (run !== leader && run.canRetire()) run.retired = true;
      live = this.live();
    }
    if (!live.length) return null;
    const pick = live[Math.floor(this.rng() * live.length)];
    return { axis: pick.axis, severity: pick.sev };
  }

  /** @param {string} axis @param {boolean} correct @param {Confidence} confidence */
  record(axis, correct, confidence, rtMs) {
    const run = this.runs.get(axis);
    if (!run) throw new RangeError(`unknown axis: ${axis}`);
    run.record(correct, confidence, rtMs);
    this.total++;
  }

  /**
   * The staircase settles on the severity you just barely DETECT. A faithful
   * simulation wants the one below it: the strongest transform that still
   * slips past you unnoticed.
   */
  result() {
    const ranked = [...this.runs.values()].sort((a, b) => b.estimate() - a.estimate());
    const toDeficiency = run => ({
      axis: run.axis,
      detection: run.estimate(),
      sev: Math.max(0, run.estimate() - 1),
      trials: run.trials,
      reversals: run.reversals.length,
      retired: run.retired,
      log: run.log,
    });
    const [first, second] = ranked.map(toDeficiency);
    return {
      primary: first,
      secondary: second && second.sev > 0 ? second : undefined,
      all: ranked.map(toDeficiency),
      totalTrials: this.total,
    };
  }
}

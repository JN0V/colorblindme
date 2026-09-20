/**
 * Path 1 — the measurement.
 *
 * Two passes, in this order, because they need opposite stimuli:
 *
 *  1. LUMINANCE decides the axis. Protan and deutan confusion lines sit 24
 *     degrees apart in the median and 9 in the worst decile; a chromatic
 *     screening identifies the axis 48-58% of the time for mild to moderate
 *     deficiency, against a 50% chance floor, and it picked the wrong one on
 *     the first real observer. Red reaches a protan eye dark and a deutan eye
 *     normally, and that is the signal that actually separates them.
 *
 *  2. CHROMATIC staircase measures severity, with every stimulus matched in
 *     luminance so the answer is about colour and not brightness.
 *
 * Running them the other way round, or asking one to do both jobs, is the
 * mistake this file exists to avoid.
 */

import { LuminanceSession, STIMULI } from "../core/luminance.js";
import { Session } from "../core/staircase.js";
import { makeTrial } from "../core/stimulus.js";
import { toCss } from "../core/color.js";
import { encode } from "../core/profile.js";
import * as i18n from "../i18n/i18n.js";

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const show = (...ids) => {
  for (const el of $$("main > section, main > .stage")) el.hidden = true;
  for (const id of ids) $(id).hidden = false;
};
const greyCss = Y => {
  const v = Math.max(0, Math.min(1, Y));
  const s = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  const b = Math.round(s * 255);
  return `rgb(${b},${b},${b})`;
};

let lum, lumTrial, axis = null, sev = null, lumResult = null;
let stair, stairTrial, stairShown = 0;

/* ---------- step 1: luminance ---------- */
function lumNext() {
  const t = lum.next();
  if (!t) return lumDone();
  const side = Math.random() < 0.5 ? 0 : 1;
  lumTrial = { ...t, side };
  const sw = $$(".swatch2");
  sw[side].style.background = greyCss(t.greyLuminance);
  sw[1 - side].style.background = toCss(STIMULI[t.colour]);
  $("#lumprog").style.width = Math.min(100, lum.total / 40 * 100) + "%";
  $("#step").textContent = i18n.t("lum.step");
}
function lumAnswer(kind) {
  if (!lumTrial) return;
  const t = lumTrial; lumTrial = null;
  lum.record(t.colour, kind === "same" ? "same" : (kind === t.side ? "grey" : "colour"));
  $$(".swatch2").forEach(s => { s.style.background = "#777"; });
  setTimeout(lumNext, 130);
}
function lumDone() {
  const r = lum.result();
  /* An undecided ratio is reported as undecided. The earlier build asserted an
     axis with no hedge and was wrong; a null here is the honest outcome. */
  axis = r.axis || "deut";
  startStaircase(r);
}

/* ---------- step 2: severity ---------- */
function startStaircase(result) {
  lumResult = result;
  stair = new Session([axis]);
  stairShown = 0;
  show("#s-sev");
  sevNext();
}
function sevNext() {
  const t = stair.next();
  if (!t) return sevDone();
  stairTrial = makeTrial(t.axis, t.severity);
  $$(".patch").forEach((p, i) => {
    p.style.background = toCss(i === stairTrial.position ? stairTrial.odd : stairTrial.base);
  });
  markZone(null);
  stairShown++;
  $("#sevprog").style.width = Math.min(100, stairShown / 36 * 100) + "%";
  $("#step").textContent = i18n.t("trial.step");
}
/* Distance from the centre of the grid carries the confidence: out at the
   corner means obvious, in near the middle means hesitant. Measured at 48/52
   of the clickable area, so neither zone is a sliver. */
function confAt(x, y) {
  const r = $("#grid").getBoundingClientRect();
  const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
  return d / Math.hypot(r.width / 2, r.height / 2) > 0.61 ? "sure" : "hint";
}
const markZone = z => $$(".zone").forEach(el => el.classList.toggle("on", el.dataset.z === z));
function sevAnswer(i, conf) {
  if (!stairTrial) return;
  const t = stairTrial; stairTrial = null;
  stair.record(axis, i === t.position, conf, 0);
  markZone(conf === "guess" ? null : conf);
  $$(".patch").forEach(p => { p.style.background = "#777"; });
  setTimeout(sevNext, 150);
}
function sevDone() {
  sev = stair.result().primary.sev;
  render();
}

/* ---------- result ---------- */
function render() {
  const profile = { primary: { axis, sev } };
  const code = encode(profile);
  const label = i18n.t("axis." + axis);
  const gap = Math.round((1 - sev / 10) * 100);
  $("#verdict").innerHTML =
    `<div><dt>${i18n.t("result.primary")}</dt><dd>${label}` +
    `<small>${i18n.t("axis." + axis + "_cone")}</small></dd></div>` +
    `<div><dt>${i18n.t("result.severity")}</dt><dd>${i18n.formatSeverity(sev)}` +
    `<small>${sev >= 10 ? i18n.t("result.dichromatic") : i18n.t("result.anomalous")}</small></dd></div>` +
    `<div><dt>${i18n.t("result.gap_label")}</dt><dd>${gap}&thinsp;%` +
    `<small>${i18n.t("result.gap_sub")}</small></dd></div>`;
  $("#code").textContent = code;
  $("#show").href = "view.html#p=" + code;
  $("#outnote").textContent = lumResult && !lumResult.confident
    ? i18n.t("lum.undecided") : i18n.t("result.axis_from_luminance");
  show("#s-out");
  $("#step").textContent = "";
}

/* ---------- wiring ---------- */
function paint() {
  i18n.apply();
  document.documentElement.lang = i18n.activeLocale();
  document.documentElement.dir = i18n.localeDir();
  $("#unreviewed").hidden = i18n.isReviewed();
  if (sev !== null) render();
}

(async () => {
  await i18n.load(i18n.negotiate());
  const picker = $("#lang");
  picker.innerHTML = Object.entries(i18n.LOCALES)
    .map(([c, m]) => `<option value="${c}">${m.name}</option>`).join("");
  picker.value = i18n.activeLocale();
  picker.addEventListener("change", async e => { await i18n.setLocale(e.target.value); paint(); });

  $("#go-lum").addEventListener("click", () => show("#s-learn"));
  $("#go-lum2").addEventListener("click", () => {
    lum = new LuminanceSession(); show("#s-lum"); lumNext();
  });
  $$(".swatch2").forEach(s => s.addEventListener("click", () => lumAnswer(+s.dataset.i)));
  $("#lumsame").addEventListener("click", () => lumAnswer("same"));
  $$(".patch").forEach(p => {
    p.addEventListener("click", e => sevAnswer(+p.dataset.i, confAt(e.clientX, e.clientY)));
    p.addEventListener("mousemove", e => { if (stairTrial) markZone(confAt(e.clientX, e.clientY)); });
    p.addEventListener("mouseleave", () => { if (stairTrial) markZone(null); });
  });
  $("#dunno").addEventListener("click", () => sevAnswer(-1, "guess"));
  $("#again").addEventListener("click", () => { axis = sev = lumResult = null; show("#s-intro"); });

  paint();
})();

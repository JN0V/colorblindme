/**
 * Path 2 — the viewer.
 *
 * Someone is handed a link. They open it on a phone. The camera or a photo
 * shows the world, a divider splits it, and one side is what the person who
 * sent the link actually sees. That is the whole product; measuring is only
 * how the number gets there.
 *
 * Two decisions this file exists to enforce:
 *
 *  - The measured severity is the default, and the slider lives behind a
 *    settings button. Left in the open it gets dragged to 1.0 within seconds,
 *    and the viewer is back to the "oh you poor thing" reaction the project
 *    is built to kill.
 *  - The page opens already showing something. A drawn garden stands in until
 *    a camera or a photo replaces it, because an empty frame makes no argument.
 */

import { matrixFor } from "../core/machado.js";
import { applyMatrixToImageData } from "../core/color.js";
import { fromHash, decode, encode, toShareURL, PRESETS } from "../core/profile.js";
import * as i18n from "../i18n/i18n.js";
import { drawScene } from "./scene.js";

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const state = {
  profile: null,
  severity: null,      // shown severity; starts at the measured one
  source: "scene",     // scene | photo | camera
  split: 0.5,
  triptych: false,
  note: null,          // kept as translation KEYS, so it survives a language switch
};

/* ---------- canvases ---------- */
const src = document.createElement("canvas");
const sctx = src.getContext("2d", { willReadFrequently: true });
let base, sim, bctx, simctx;

function sizeTo(w, h) {
  src.width = w; src.height = h;
  for (const c of [base, sim]) { c.width = w; c.height = h; }
  for (const c of $$(".tri canvas")) { c.width = w; c.height = h; }
}

/** Paint whatever the current source is into `src`. */
function paintSource() {
  if (state.source === "camera" && cam.videoWidth) {
    sctx.drawImage(cam, 0, 0, src.width, src.height);
  } else if (state.source === "photo" && photo) {
    sctx.drawImage(photo, 0, 0, src.width, src.height);
  } else {
    drawScene(sctx, src.width, src.height);
  }
}

function simulateInto(ctx, severity) {
  const m = matrixFor(state.profile.primary.axis, severity);
  const img = sctx.getImageData(0, 0, src.width, src.height);
  ctx.putImageData(applyMatrixToImageData(img, m), 0, 0);
}

function render() {
  if (!state.profile) return;
  paintSource();
  bctx.drawImage(src, 0, 0);
  simulateInto(simctx, state.severity);
  if (state.triptych) {
    const [a, b, c] = $$(".tri canvas");
    a.getContext("2d").drawImage(src, 0, 0);
    simulateInto(b.getContext("2d"), state.severity);
    simulateInto(c.getContext("2d"), 10);
  }
  placeDivider();
}

function placeDivider() {
  const pct = (state.split * 100).toFixed(2) + "%";
  $(".top").style.clipPath = `inset(0 0 0 ${pct})`;
  $(".divider").style.left = pct;
  $(".grip").style.left = pct;
}

/* ---------- the divider ---------- */
function bindWipe() {
  const stage = $(".stage");
  const move = e => {
    const r = stage.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    state.split = Math.max(0, Math.min(1, x / r.width));
    placeDivider();
  };
  const down = e => { move(e); window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true }); };
  const up = () => window.removeEventListener("pointermove", move);
  stage.addEventListener("pointerdown", down);
  stage.addEventListener("keydown", e => {
    const step = e.shiftKey ? 0.1 : 0.02;
    if (e.key === "ArrowLeft") { state.split = Math.max(0, state.split - step); placeDivider(); }
    if (e.key === "ArrowRight") { state.split = Math.min(1, state.split + step); placeDivider(); }
  });
}

/* ---------- sources ---------- */
let photo = null;
const cam = document.createElement("video");
cam.playsInline = true; cam.muted = true;
/* Not display:none, which stops some engines decoding, and not parked far
   off-screen either, which some throttle. One transparent pixel, in view. */
Object.assign(cam.style, { position: "fixed", right: "0", bottom: "0",
  width: "1px", height: "1px", opacity: "0.01", pointerEvents: "none", zIndex: "-1" });
document.body.appendChild(cam);
let stream = null, live = false, lastFrame = 0;

function stopCam() {
  live = false;
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  cam.srcObject = null;
}
/**
 * Starting the camera, and saying why when it will not start.
 *
 * The failure that prompted all this reported nothing at all. Browsers built
 * on Android's system WebView — LineageOS's Jelly among them — deny a
 * getUserMedia request with no OS prompt and, in some builds, no rejection
 * either: the promise simply never settles. "It does not work and I cannot
 * tell why" is the worst outcome an accessibility tool can produce, so every
 * branch here ends in a specific sentence, and the raw error name is shown so
 * a report is actionable.
 */
async function cameraDiagnosis() {
  if (!window.isSecureContext) return "camera.insecure";
  if (!navigator.mediaDevices?.getUserMedia) return "camera.unsupported";
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    if (devices.length && !devices.some(d => d.kind === "videoinput")) return "camera.notfound";
  } catch { /* enumerateDevices can itself be blocked; not decisive */ }
  return null;
}

/** Resolve once the element actually has pixel dimensions. Polls on a timer
    rather than requestAnimationFrame, which browsers throttle or stop while a
    permission prompt is up or the page is not visible — the poll would then
    never tick, and a working camera would time out. */
function frames(ms) {
  return new Promise((res, rej) => {
    const t0 = Date.now();
    (function tick() {
      if (cam.videoWidth) return res();
      if (Date.now() - t0 > ms) return rej(Object.assign(new Error("no frame"), { name: "NoFrame" }));
      setTimeout(tick, 120);
    })();
  });
}

/** Ask for the rear camera, then for any camera. An ideal constraint is not
    supposed to fail, but on older hardware the negotiated mode can still come
    back unusable, and a plain request often succeeds where a shaped one does not. */
async function requestStream(diag) {
  const attempts = [{ video: { facingMode: { ideal: "environment" } } }, { video: true }];
  let last;
  for (const [i, constraints] of attempts.entries()) {
    try {
      const got = await Promise.race([
        navigator.mediaDevices.getUserMedia(constraints),
        new Promise((_, rej) =>
          setTimeout(rej, 12000, Object.assign(new Error("no answer"), { name: "Timeout" }))),
      ]);
      diag.attempt = i + 1;
      return got;
    } catch (e) {
      last = e;
      diag["attempt" + (i + 1)] = e.name;
      if (e.name === "NotAllowedError" || e.name === "Timeout") throw e;
    }
  }
  throw last;
}

async function startCam() {
  if (live) { stopCam(); state.source = "scene"; fit(); render(); setNote(null); return; }

  const blocked = await cameraDiagnosis();
  if (blocked) return setNote([blocked, "camera.fallback"], "warn");

  const diag = { secure: String(window.isSecureContext), ua: navigator.userAgent.slice(0, 80) };
  try {
    stopCam();
    setNote("camera.asking", "info");
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      diag.videoinputs = devs.filter(d => d.kind === "videoinput").length;
    } catch (e) { diag.videoinputs = "enumerate:" + e.name; }

    stream = await requestStream(diag);
    const track = stream.getVideoTracks()[0];
    diag.track = track
      ? track.readyState + "/" + (track.enabled ? "on" : "off") + "/" + (track.muted ? "muted" : "live")
      : "none";
    const set = (track && track.getSettings) ? track.getSettings() : {};
    diag.settings = (set.width || "?") + "x" + (set.height || "?") + " " + (set.facingMode || "?");

    cam.srcObject = stream;
    /* play() BEFORE waiting on dimensions: several engines withhold
       loadedmetadata for a MediaStream until playback starts. */
    try { await cam.play(); diag.play = "ok"; } catch (e) { diag.play = e.name; }
    await frames(8000);

    state.source = "camera"; live = true; photo = null;
    fit(); setNote(null);
    loop();
  } catch (err) {
    stopCam();
    diag.error = err.name;
    diag.video = cam.videoWidth + "x" + cam.videoHeight + " readyState=" + cam.readyState;
    const known = {
      NotAllowedError: "camera.denied", NotFoundError: "camera.notfound",
      NotReadableError: "camera.busy", OverconstrainedError: "camera.notfound",
      SecurityError: "camera.insecure", Timeout: "camera.timeout", NoFrame: "camera.noframe",
    }[err.name];
    setNote([known || "camera.unknown", "camera.fallback"], "warn", diag);
  }
}

function loop(t) {
  if (!live) return;
  requestAnimationFrame(loop);
  if (t && t - lastFrame < 66) return;    /* ~15fps is plenty and keeps the transform cheap */
  lastFrame = t || 0;
  if (cam.videoWidth) render();
}
function loadPhoto(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { stopCam(); photo = img; state.source = "photo"; fit(); render();
    URL.revokeObjectURL(url); setNote(null); };
  img.onerror = () => { URL.revokeObjectURL(url); setNote("view.badimage", "warn"); };
  img.src = url;
}

/** Match the canvas to the current source's aspect, capped for performance. */
function fit() {
  let w = 1080, h = 720;
  if (state.source === "camera" && cam.videoWidth) { w = cam.videoWidth; h = cam.videoHeight; }
  else if (state.source === "photo" && photo) { w = photo.naturalWidth; h = photo.naturalHeight; }
  const k = Math.min(1, 1080 / w);
  sizeTo(Math.round(w * k), Math.round(h * k));
  render();
}

function setNote(keys, kind, diag) {
  state.note = keys ? { keys: [].concat(keys), kind, diag } : null;
  paintNote();
}
function paintNote() {
  const el = $("#note");
  el.hidden = !state.note;
  if (!state.note) { el.textContent = ""; return; }
  el.className = "note" + (state.note.kind === "warn" ? "" : " info");
  el.textContent = state.note.keys.map(k => i18n.t(k)).join(" ");
  /* When a failure is not self-explanatory, the page reports what it saw.
     Guessing across a conversation costs a round trip per hypothesis; this
     costs one. */
  if (state.note.diag) {
    const d = document.createElement("details");
    d.style.marginTop = "10px";
    const sum = document.createElement("summary");
    sum.textContent = i18n.t("camera.details");
    sum.style.cursor = "pointer";
    const pre = document.createElement("pre");
    pre.style.cssText = "margin:8px 0 0;font-size:11px;white-space:pre-wrap;user-select:all;border:0;padding:0;background:none";
    pre.textContent = Object.entries(state.note.diag).map(([k, v]) => k + ": " + v).join("\n");
    d.append(sum, pre);
    el.append(d);
  }
}

/* ---------- profile ---------- */
function applyProfile(p, { remember = true } = {}) {
  state.profile = p;
  state.severity = p.primary.sev;
  $("#sev").value = p.primary.sev;
  $("#sev").max = 10;
  paintProfile();
  if (remember) history.replaceState(null, "", "#p=" + encode(p));
  render();
}
function paintProfile() {
  const p = state.profile, axis = i18n.t("axis." + p.primary.axis);
  $("#who").innerHTML = `${i18n.t("view.profile")} <b>${axis}</b> <code>${encode(p)}</code>`;
  $(".tag.r").textContent = i18n.t("view.theirs");
  $(".tag.l").textContent = i18n.t("view.yours");
  const measured = state.severity === p.primary.sev;
  $("#sevval").innerHTML = i18n.formatSeverity(state.severity) +
    (measured ? ` <em>· ${i18n.t("view.measured")}</em>` : "");
  $("#capmid").textContent = `${axis} · ${i18n.formatSeverity(state.severity)}`;
}

/* ---------- language, swapped in place ---------- */
function buildPresets() {
  $(".presets").innerHTML = PRESETS.map(pr =>
    `<button class="preset" type="button" data-code="${encode(pr.profile)}">` +
    `<code>${encode(pr.profile)}</code>` +
    `<span>${i18n.t("load.preset_" + pr.id.replace("-", "_"))}</span></button>`).join("");
  $$(".preset").forEach(b => b.addEventListener("click", () => {
    applyProfile(decode(b.dataset.code));
    $("#sheet").hidden = true;
    setNote("load.preset_warning", "warn");
  }));
}

/* Everything language-dependent is repainted here — static markup and the
   strings the app built itself. Nothing navigates, so the shared profile in
   the fragment cannot be lost on the way. */
function applyLanguage() {
  i18n.apply();
  document.documentElement.lang = i18n.activeLocale();
  document.documentElement.dir = i18n.localeDir();
  $("#unreviewed").hidden = i18n.isReviewed();
  buildPresets();
  if (state.profile) paintProfile();
  paintNote();
}

/* ---------- boot ---------- */
async function boot() {
  await i18n.load(i18n.negotiate());

  base = $("#base"); sim = $("#sim");

  const picker = $("#lang");
  picker.innerHTML = Object.entries(i18n.LOCALES)
    .map(([code, meta]) => `<option value="${code}">${meta.name}</option>`).join("");
  picker.value = i18n.activeLocale();
  picker.addEventListener("change", async e => {
    await i18n.setLocale(e.target.value);
    applyLanguage();
  });
  bctx = base.getContext("2d"); simctx = sim.getContext("2d");

  bindWipe();
  $("#sev").addEventListener("input", e => {
    state.severity = +e.target.value; paintProfile(); render();
  });
  $("#camera").addEventListener("click", startCam);
  $("#photo").addEventListener("change", e => { if (e.target.files?.[0]) loadPhoto(e.target.files[0]); });
  $("#gear").addEventListener("click", () => { const s = $("#sheet"); s.hidden = !s.hidden; });
  $("#tri").addEventListener("change", e => {
    state.triptych = e.target.checked; $(".tri").hidden = !state.triptych; render();
  });
  $("#apply").addEventListener("click", () => {
    const p = decode($("#code").value);
    if (!p) return setNote("load.invalid", "warn");
    setNote(null); applyProfile(p); $("#sheet").hidden = true;
  });
  applyLanguage();

  const shared = fromHash();
  if (shared) { applyProfile(shared, { remember: false }); }
  else {
    applyProfile(PRESETS[0].profile, { remember: false });
    $("#sheet").hidden = false;
    setNote("view.nocode", "warn");
  }
  fit();
  window.addEventListener("resize", () => placeDivider());
}
boot();

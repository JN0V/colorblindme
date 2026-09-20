/**
 * Minimal i18n for a static, build-free, server-free site.
 *
 * Three rules this app cannot break:
 *
 *  1. A vision code is NEVER localised. "D5-P2" uses protan/deutan/tritan
 *     initials as fixed ASCII so a code shared between a French parent and a
 *     German colleague still resolves. Translating those letters would
 *     silently fork the format. See core/profile.js.
 *
 *  2. Numbers ARE localised. Severity shows as "0,5" in French and "0.5" in
 *     English; it is read aloud constantly, so it goes through Intl.
 *
 *  3. Clinical vocabulary is hand-translated or flagged. "Deuteranomaly" has
 *     an exact equivalent in every language we ship, and the limitations
 *     section makes careful claims about what the measurement does not prove.
 *     A machine translation there can turn a hedge into a medical assertion,
 *     so every catalogue declares its review status and unreviewed locales
 *     say so in the interface.
 *
 * English is the SOURCE language: strings are authored in en.json and every
 * other catalogue is a translation of it. It is also the fallback, so a gap in
 * any locale degrades to English rather than to a raw key.
 */

const FALLBACK = "en";

/** Locales we ship. `dir` drives layout mirroring; `status` drives the banner. */
export const LOCALES = {
  en: { name: "English",  dir: "ltr", status: "reviewed", source: true },
  fr: { name: "Français", dir: "ltr", status: "reviewed" },
};

let current = FALLBACK;
let strings = {};
let numberFmt = new Intl.NumberFormat(FALLBACK, { minimumFractionDigits: 1 });

export function activeLocale() { return current; }
export function localeDir() { return LOCALES[current]?.dir ?? "ltr"; }
export function isReviewed() { return LOCALES[current]?.status === "reviewed"; }

/**
 * Best supported locale for this visitor: ?lang= in the address wins, then a
 * remembered choice, then the browser, then English.
 *
 * There is ONE page, not one per locale. Language is swapped in place and
 * nothing ever navigates, which matters more here than it looks: the profile
 * being shared rides in the URL fragment, and an earlier build that served
 * /en/ and /fr/ dropped that fragment the moment someone switched language.
 * A design where nothing navigates cannot lose it.
 */
export function negotiate(search = location.search) {
  const asked = new URLSearchParams(search).get("lang");
  if (asked && LOCALES[asked]) return asked;

  let stored = null;
  try { stored = localStorage.getItem("cbm.locale"); } catch { /* private mode */ }
  if (stored && LOCALES[stored]) return stored;

  for (const tag of navigator.languages ?? [navigator.language ?? ""]) {
    const base = String(tag).toLowerCase().split("-")[0];
    if (LOCALES[base]) return base;
  }
  return FALLBACK;
}

/**
 * Switch language in place: load the catalogue, remember the choice, and
 * record it in the address WITHOUT touching the fragment.
 */
export async function setLocale(code) {
  const applied = await load(code);
  remember(applied);
  const url = new URL(location.href);
  url.searchParams.set("lang", applied);
  history.replaceState(null, "", url.pathname + url.search + url.hash);
  return applied;
}

export async function load(locale) {
  const code = LOCALES[locale] ? locale : FALLBACK;
  // Catalogues are fetched, so `file://` will not work: run a local server
  // (`python3 -m http.server`). Documented in the README.
  const res = await fetch(new URL(`./locales/${code}.json`, import.meta.url));
  if (!res.ok) throw new Error(`missing catalogue: ${code}`);
  strings = await res.json();
  current = code;
  numberFmt = new Intl.NumberFormat(code, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  document.documentElement.lang = code;
  document.documentElement.dir = localeDir();
  return code;
}

export function remember(locale) {
  try { localStorage.setItem("cbm.locale", locale); } catch { /* ignore */ }
}

/** Dotted lookup with {placeholder} interpolation. Missing keys return the key. */
export function t(key, vars) {
  let node = strings;
  for (const part of key.split(".")) {
    if (node == null || typeof node !== "object") { node = undefined; break; }
    node = node[part];
  }
  if (typeof node !== "string") {
    if (import.meta.env?.DEV) console.warn(`[i18n] missing: ${key}`);
    return key;
  }
  if (!vars) return node;
  return node.replace(/\{(\w+)\}/g, (m, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : m);
}

/** Plural-aware lookup: `key.one` / `key.other`, per the locale's own rules. */
export function tn(key, count, vars) {
  const rule = new Intl.PluralRules(current).select(count);
  const merged = { count: formatCount(count), ...vars };
  const exact = t(`${key}.${rule}`, merged);
  return exact === `${key}.${rule}` ? t(`${key}.other`, merged) : exact;
}

/** Severity, always one decimal: "0,5" / "0.5". */
export function formatSeverity(sev10) { return numberFmt.format(sev10 / 10); }

export function formatCount(n) { return new Intl.NumberFormat(current).format(n); }

/** Translate every [data-i18n] node; attributes via data-i18n-attr="aria-label:key". */
export function apply(root = document) {
  for (const el of root.querySelectorAll("[data-i18n]")) {
    el.textContent = t(el.getAttribute("data-i18n"));
  }
  for (const el of root.querySelectorAll("[data-i18n-attr]")) {
    for (const pair of el.getAttribute("data-i18n-attr").split(";")) {
      const [attr, key] = pair.split(":").map(s => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    }
  }
}

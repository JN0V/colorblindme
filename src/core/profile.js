/**
 * Vision profiles and the codes that carry them.
 *
 * A profile is the whole product: measuring it is a means, sharing it is the
 * point. So the code has to survive being read aloud over the phone, typed by
 * a child, and pasted between people who do not share a language.
 *
 *   CBM1-D5-P2
 *   |   |  |
 *   |   |  +-- secondary deficiency (optional): protan, severity 0.2
 *   |   +----- primary deficiency: deutan, severity 0.5
 *   +--------- format version
 *
 * The axis letters are FIXED ASCII (P/D/T, from protan/deutan/tritan) and are
 * never translated. Localising them would fork the format the first time a
 * code crossed a language boundary, and the failure would be silent: a valid
 * code resolving to the wrong axis.
 *
 * Profiles ride in the URL *fragment*, which browsers never send to the
 * server. On static hosting that is not just convenient, it is the whole
 * privacy claim: a measurement of someone's vision never leaves their device.
 */

const VERSION = "CBM1";
const LETTER = { prot: "P", deut: "D", trit: "T" };
const AXIS_OF = { P: "prot", D: "deut", T: "trit" };

/** @typedef {{axis:"prot"|"deut"|"trit", sev:number}} Deficiency */
/** @typedef {{primary:Deficiency, secondary?:Deficiency}} Profile */

const validSev = v => Number.isInteger(v) && v >= 0 && v <= 10;

export function isValid(profile) {
  if (!profile?.primary) return false;
  const ok = d => d && AXIS_OF[LETTER[d.axis]] && validSev(d.sev);
  return ok(profile.primary) && (!profile.secondary || ok(profile.secondary));
}

/** @param {Profile} profile @returns {string} e.g. "CBM1-D5-P2" */
export function encode(profile) {
  if (!isValid(profile)) throw new TypeError("invalid profile");
  const part = d => `${LETTER[d.axis]}${d.sev}`;
  const bits = [VERSION, part(profile.primary)];
  // A secondary deficiency at 0 carries no information; leave it out so the
  // common code stays short enough to dictate.
  if (profile.secondary && profile.secondary.sev > 0) bits.push(part(profile.secondary));
  return bits.join("-");
}

/**
 * Parse a code. Tolerant of what humans actually type: lower case, spaces,
 * and the version prefix left off.
 * @returns {Profile|null} null when the code is not usable
 */
export function decode(code) {
  if (typeof code !== "string") return null;
  const cleaned = code.trim().toUpperCase().replace(/[\s_]+/g, "-");
  const parts = cleaned.split("-").filter(Boolean);
  if (parts[0] === VERSION) parts.shift();
  else if (/^CBM\d+$/.test(parts[0] ?? "")) return null;   // a version we do not know

  const read = s => {
    const m = /^([PDT])(\d{1,2})$/.exec(s ?? "");
    if (!m) return null;
    const sev = Number(m[2]);
    return validSev(sev) ? { axis: AXIS_OF[m[1]], sev } : null;
  };
  const primary = read(parts[0]);
  if (!primary) return null;
  const profile = { primary };
  if (parts.length > 1) {
    const secondary = read(parts[1]);
    if (!secondary) return null;
    if (secondary.axis === primary.axis) return null;     // same axis twice is a typo
    if (secondary.sev > 0) profile.secondary = secondary;
  }
  return profile;
}

/** Read a profile out of a URL fragment such as "#p=CBM1-D5-P2". */
export function fromHash(hash = location.hash) {
  const raw = String(hash).replace(/^#/, "");
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const code = params.get("p");
  if (code) return decode(code);
  // Also accept a bare "#CBM1-D5-P2", which is what people paste by hand.
  return decode(raw);
}

/** Build a shareable absolute URL. Keeps any other fragment params intact. */
export function toShareURL(profile, base = location.href) {
  const url = new URL(base);
  const params = new URLSearchParams(url.hash.replace(/^#/, ""));
  params.set("p", encode(profile));
  url.hash = params.toString();
  return url.toString();
}

/** Presets offered when nobody has a code to share. Approximations, labelled as such. */
export const PRESETS = [
  { id: "deut-mid", profile: { primary: { axis: "deut", sev: 5 } } },
  { id: "prot-mid", profile: { primary: { axis: "prot", sev: 5 } } },
  { id: "deut-full", profile: { primary: { axis: "deut", sev: 10 } } },
];

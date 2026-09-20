/** sRGB <-> linear light, relative luminance, and CIE Lab for colour distance. */

const S2L = new Float64Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  S2L[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
const STEPS = 4096;
const L2S = new Uint8Array(STEPS + 1);
for (let i = 0; i <= STEPS; i++) {
  const v = i / STEPS;
  const s = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  L2S[i] = Math.max(0, Math.min(255, Math.round(s * 255)));
}

export const toLinear = byte => S2L[byte];
export const toByte = v => L2S[Math.max(0, Math.min(STEPS, (v * STEPS) | 0))];

export const YR = 0.2126, YG = 0.7152, YB = 0.0722;
export const luminance = (r, g, b) => YR * r + YG * g + YB * b;

/**
 * Apply a Machado matrix in linear light.
 *
 * `matchLuminance` rescales the result back to the source luminance. The test
 * needs it: without it the odd square differs in brightness, which you
 * perceive normally, and you answer on that instead of on colour. Display does
 * NOT want it — the luminance shift is part of what the simulation is showing.
 */
export function applyMatrix([r8, g8, b8], m, matchLuminance = false) {
  const r = S2L[r8], g = S2L[g8], b = S2L[b8];
  let o0 = m[0] * r + m[1] * g + m[2] * b;
  let o1 = m[3] * r + m[4] * g + m[5] * b;
  let o2 = m[6] * r + m[7] * g + m[8] * b;
  if (matchLuminance) {
    const after = luminance(o0, o1, o2);
    if (after > 1e-6) {
      const k = luminance(r, g, b) / after;
      o0 *= k; o1 *= k; o2 *= k;
    }
  }
  const clipped = o0 < -0.002 || o0 > 1.002 || o1 < -0.002 || o1 > 1.002
                || o2 < -0.002 || o2 > 1.002;
  return { rgb: [toByte(o0), toByte(o1), toByte(o2)], clipped };
}

export function toLab([r8, g8, b8]) {
  const r = S2L[r8], g = S2L[g8], b = S2L[b8];
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const Y =  0.2126729 * r + 0.7151522 * g + 0.0721750 * b;
  const Z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883;
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIE76. Coarse, but adequate for picking stimuli far above threshold. */
export function deltaE(a, b) {
  const A = toLab(a), B = toLab(b);
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}

/**
 * Transform an ImageData in place. The per-pixel path deliberately avoids the
 * array/object churn of applyMatrix: a 1200x800 frame is a million pixels and
 * this runs every frame in camera mode.
 *
 * No luminance matching here. That correction belongs to the measurement,
 * where a brightness cue would let the eye cheat; a simulation shown to
 * someone else must keep the luminance shift, because it is part of what the
 * deficiency does.
 */
export function applyMatrixToImageData(image, m) {
  const p = image.data;
  const [a, b, c, d, e, f, g, h, i] = m;
  for (let k = 0; k < p.length; k += 4) {
    const r = S2L[p[k]], gr = S2L[p[k + 1]], bl = S2L[p[k + 2]];
    p[k]     = toByte(a * r + b * gr + c * bl);
    p[k + 1] = toByte(d * r + e * gr + f * bl);
    p[k + 2] = toByte(g * r + h * gr + i * bl);
  }
  return image;
}

export const toCss = ([r, g, b]) => `rgb(${r},${g},${b})`;

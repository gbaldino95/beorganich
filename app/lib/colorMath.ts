// app/lib/colorMath.ts
// Minimal, dependency-free color math: HEX -> sRGB -> XYZ -> Lab + DeltaE (CIE76)

export type Lab = { L: number; a: number; b: number };

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) throw new Error(`Invalid hex: ${hex}`);
  const n = parseInt(h, 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

// sRGB 0..255 -> linear 0..1
function srgbToLinear(c: number) {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

// linear RGB -> XYZ (D65)
function rgbToXyz(r: number, g: number, b: number) {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);

  // sRGB D65 matrix
  const X = R * 0.4124564 + G * 0.3575761 + B * 0.1804375;
  const Y = R * 0.2126729 + G * 0.7151522 + B * 0.0721750;
  const Z = R * 0.0193339 + G * 0.1191920 + B * 0.9503041;

  return { X, Y, Z };
}

// XYZ -> Lab (D65 reference white)
function xyzToLab(X: number, Y: number, Z: number): Lab {
  // D65 reference white
  const Xn = 0.95047;
  const Yn = 1.0;
  const Zn = 1.08883;

  let x = X / Xn;
  let y = Y / Yn;
  let z = Z / Zn;

  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : (7.787 * t) + 16 / 116);

  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  const L = (116 * fy) - 16;
  const a = 500 * (fx - fy);
  const b = 200 * (fy - fz);

  return { L, a, b };
}

export function hexToLab(hex: string): Lab {
  const { r, g, b } = hexToRgb(hex);
  const { X, Y, Z } = rgbToXyz(r, g, b);
  return xyzToLab(X, Y, Z);
}

// DeltaE CIE76 (semplice, veloce, sufficiente per matching palette)
export function deltaE(l1: Lab, l2: Lab) {
  const dL = l1.L - l2.L;
  const da = l1.a - l2.a;
  const db = l1.b - l2.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

// helper: validate hex
export function normalizeHex(hex: string) {
  const h = hex.trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(h)) throw new Error(`Invalid HEX: ${hex}`);
  return h;
}
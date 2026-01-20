// app/lib/skinSampling.ts
import type { Landmark } from "@mediapipe/tasks-vision";
import type { Sample } from "@/app/lib/paletteMatcher";

/**
 * Landmark ids (MediaPipe FaceMesh – standard)
 * - nose tip: 1
 * - forehead/glabella: 10
 * - left cheek: 234
 * - right cheek: 454
 * - chin: 152
 *
 * Se in futuro vuoi ancora più precisione: aggiungiamo 2-3 punti per guancia e fronte.
 */
const PTS = {
  nose: 1,
  forehead: 10,
  cheekL: 234,
  cheekR: 454,
  chin: 152,
};

type RGB = { r: number; g: number; b: number };

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function toHex(v: number) {
  const x = clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");
  return x.toUpperCase();
}
function rgbToHex({ r, g, b }: RGB) {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function luma(rgb: RGB) {
  // perceived luminance
  return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
}

function getPt(landmarks: Landmark[], id: number) {
  const p = landmarks?.[id];
  if (!p) return null;
  return { x: p.x, y: p.y };
}

function median(nums: number[]) {
  if (!nums.length) return 0;
  const a = [...nums].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function avgRGB(pixels: Uint8ClampedArray) {
  // pixels = [r,g,b,a, r,g,b,a, ...]
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3];
    if (a < 10) continue;
    r += pixels[i + 0];
    g += pixels[i + 1];
    b += pixels[i + 2];
    n++;
  }
  if (!n) return null;
  return { r: r / n, g: g / n, b: b / n };
}

/**
 * Campiona un quadratino attorno al punto (x,y) (normalizzato 0..1)
 * con raggio proporzionale alla faccia.
 */
function samplePatchHex(
  ctx: CanvasRenderingContext2D,
  xN: number,
  yN: number,
  w: number,
  h: number,
  radiusPx: number
) {
  const x = Math.round(xN * w);
  const y = Math.round(yN * h);

  const r = Math.round(radiusPx);
  const sx = clamp(x - r, 0, w - 1);
  const sy = clamp(y - r, 0, h - 1);
  const sw = clamp(r * 2, 2, w - sx);
  const sh = clamp(r * 2, 2, h - sy);

  try {
    const img = ctx.getImageData(sx, sy, sw, sh);
    const rgb = avgRGB(img.data);
    if (!rgb) return null;

    // filtri anti-ombra / anti-highlight (molto importanti)
    const Y = luma(rgb);
    if (Y < 35) return null;      // troppo scuro (ombra)
    if (Y > 235) return null;     // troppo chiaro (riflesso)
    return rgbToHex(rgb);
  } catch {
    return null;
  }
}

/**
 * ✅ FUNZIONE PRINCIPALE
 * prende landmarks + canvas, produce samples weighted per matchPaletteUltra().
 */
export function buildSkinSamplesFromCanvas(
  canvas: HTMLCanvasElement,
  landmarks: Landmark[]
): { samples: Sample[]; debug: any } {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { samples: [], debug: { reason: "no_ctx" } };

  const w = canvas.width;
  const h = canvas.height;
  if (!w || !h) return { samples: [], debug: { reason: "bad_canvas_size" } };

  // stima dimensione faccia (forehead <-> chin) per raggio patch
  const pF = getPt(landmarks, PTS.forehead);
  const pC = getPt(landmarks, PTS.chin);
  const faceDist =
    pF && pC
      ? Math.hypot((pF.x - pC.x) * w, (pF.y - pC.y) * h)
      : Math.min(w, h) * 0.35;

  const radius = clamp(faceDist * 0.035, 6, 16); // patch “premium” (non troppo piccola)

  const points = [
    { id: PTS.cheekL, region: "cheekL", weight: 1.25 },
    { id: PTS.cheekR, region: "cheekR", weight: 1.25 },
    { id: PTS.forehead, region: "forehead", weight: 0.90 },
    { id: PTS.chin, region: "jaw", weight: 1.05 },
    { id: PTS.nose, region: "nose", weight: 0.75 },
  ];

  const hexes: Array<{ hex: string; region: string; weight: number; Y: number }> = [];
  const rejected: any[] = [];

  for (const p of points) {
    const pt = getPt(landmarks, p.id);
    if (!pt) {
      rejected.push({ region: p.region, reason: "missing_landmark", id: p.id });
      continue;
    }

    const hex = samplePatchHex(ctx, pt.x, pt.y, w, h, radius);
    if (!hex) {
      rejected.push({ region: p.region, reason: "bad_patch_or_luma", id: p.id });
      continue;
    }

    // calcola luma anche qui per debug
    const rgb = {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
    };
    hexes.push({ hex, region: p.region, weight: p.weight, Y: luma(rgb) });
  }

  // anti-“sempre uguale”: se ho 0–1 samples validi, è quasi certo che stai fallendo landmarks/canvas
  // => restituisco samples vuoti così il matcher non userà sempre fallback fisso senza che te ne accorgi.
  if (hexes.length < 2) {
    return {
      samples: [],
      debug: { radius, faceDist, kept: hexes, rejected, reason: "too_few_valid_samples" },
    };
  }

  // stabilizzazione: ordina per luminanza e prendi mediana come "baseHex"
  const Ys = hexes.map((x) => x.Y);
  const Ymed = median(Ys);

  // se un sample è troppo distante in luminanza dalla mediana, lo scarto (ombre/riflessi)
  const kept = hexes.filter((x) => Math.abs(x.Y - Ymed) <= 28);

  const final = (kept.length >= 2 ? kept : hexes).map((x) => ({
    hex: x.hex,
    region: x.region,
    weight: x.weight,
  })) satisfies Sample[];

  return {
    samples: final,
    debug: { radius, faceDist, Ymed: Math.round(Ymed), kept: final, rejected },
  };
}
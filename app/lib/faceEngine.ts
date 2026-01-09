"use client";

// app/lib/faceEngine.ts
import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
  ImageSegmenter,
  type ImageSegmenterResult,
} from "@mediapipe/tasks-vision";

export type Landmark = { x: number; y: number; z?: number }; // normalized 0..1
export type FaceBox = { x: number; y: number; w: number; h: number };

// ✅ Tipi corretti per il fileset MediaPipe
type VisionFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

// ✅ Singleton promises (evita doppie init + risolve errori TS)
let _filesetPromise: Promise<VisionFileset> | null = null;

let _landmarker: FaceLandmarker | null = null;
let _landmarkerPromise: Promise<FaceLandmarker> | null = null;

let _segmenter: ImageSegmenter | null = null;
let _segmenterPromise: Promise<ImageSegmenter> | null = null;

// WASM base (downloaded once, runs locally)
const MP_WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

// Face model (.task)
const FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// Segmenter model (.tflite) — selfie/person segmentation (runs locally in wasm)
const SEGMENTER_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function median(values: number[]) {
  if (!values.length) return 0;
  const a = [...values].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

function hexFromRGB(r: number, g: number, b: number) {
  const to = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

async function getFileset(): Promise<VisionFileset> {
  if (_filesetPromise) return _filesetPromise;
  _filesetPromise = FilesetResolver.forVisionTasks(MP_WASM_BASE);
  return _filesetPromise;
}

/** Face Landmarker init (on-device WASM) */
export async function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (_landmarker) return _landmarker;
  if (_landmarkerPromise) return _landmarkerPromise;

  _landmarkerPromise = (async () => {
    const vision = await getFileset();

    const lm = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: FACE_MODEL_URL },
      numFaces: 1,
      runningMode: "IMAGE", // will be switched to VIDEO at runtime
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    });

    _landmarker = lm;
    return lm;
  })();

  return _landmarkerPromise;
}

/** Image Segmenter init (on-device WASM) */
export async function getImageSegmenter(): Promise<ImageSegmenter> {
  if (_segmenter) return _segmenter;
  if (_segmenterPromise) return _segmenterPromise;

  _segmenterPromise = (async () => {
    const vision = await getFileset();

    const seg = await ImageSegmenter.createFromOptions(vision, {
      baseOptions: { modelAssetPath: SEGMENTER_MODEL_URL },
      runningMode: "IMAGE",
      outputCategoryMask: true,
      outputConfidenceMasks: false,
    });

    _segmenter = seg;
    return seg;
  })();

  return _segmenterPromise;
}

/** Detect face landmarks on IMAGE (canvas/image/bitmap) */
export async function detectFaceOnImage(input: HTMLCanvasElement | HTMLImageElement | ImageBitmap) {
  const lm = await getFaceLandmarker();
  lm.setOptions({ runningMode: "IMAGE" });

  const res: FaceLandmarkerResult = lm.detect(input);
  const face = res.faceLandmarks?.[0];
  if (!face?.length) return null;

  return face as Landmark[];
}

/** Detect face landmarks on VIDEO */
export async function detectFaceOnVideo(video: HTMLVideoElement, timestampMs: number) {
  const lm = await getFaceLandmarker();
  lm.setOptions({ runningMode: "VIDEO" });

  const res: FaceLandmarkerResult = lm.detectForVideo(video, timestampMs);
  const face = res.faceLandmarks?.[0];
  if (!face?.length) return null;

  return face as Landmark[];
}

/** Segment person mask on IMAGE (canvas/image/bitmap) */
export async function segmentPersonOnImage(input: HTMLCanvasElement | HTMLImageElement | ImageBitmap) {
  const seg = await getImageSegmenter();
  seg.setOptions({ runningMode: "IMAGE" });

  const res: ImageSegmenterResult = seg.segment(input);
  const mask = res.categoryMask;
  if (!mask) return null;

  const w = (mask as any).width ?? (input as any).width ?? 0;
  const h = (mask as any).height ?? (input as any).height ?? 0;

  let data: Float32Array | Uint8Array | null = null;
  try {
    data = (mask as any).getAsFloat32Array?.() ?? null;
  } catch {}
  if (!data) {
    try {
      data = (mask as any).getAsUint8Array?.() ?? null;
    } catch {}
  }
  if (!data) return null;

  return { w, h, data };
}

function estimateGrayWorldMultipliers(samples: Array<{ r: number; g: number; b: number }>) {
  const n = Math.max(1, samples.length);
  let mr = 0,
    mg = 0,
    mb = 0;
  for (const s of samples) {
    mr += s.r;
    mg += s.g;
    mb += s.b;
  }
  mr /= n;
  mg /= n;
  mb /= n;
  const m = (mr + mg + mb) / 3;
  return {
    kr: mr ? m / mr : 1,
    kg: mg ? m / mg : 1,
    kb: mb ? m / mb : 1,
  };
}

function applyWB(s: { r: number; g: number; b: number }, k: { kr: number; kg: number; kb: number }) {
  return {
    r: clamp(s.r * k.kr, 0, 255),
    g: clamp(s.g * k.kg, 0, 255),
    b: clamp(s.b * k.kb, 0, 255),
  };
}

type Mask = { w: number; h: number; data: Float32Array | Uint8Array };

/** Get mask value (0..1) mapping canvas coords -> mask coords */
function maskValueAt(mask: Mask, canvasW: number, canvasH: number, x: number, y: number) {
  const mx = clamp(Math.round((x / canvasW) * (mask.w - 1)), 0, mask.w - 1);
  const my = clamp(Math.round((y / canvasH) * (mask.h - 1)), 0, mask.h - 1);
  const idx = my * mask.w + mx;

  const v = mask.data[idx];
  if (mask.data instanceof Uint8Array) return v / 255;

  return clamp(v, 0, 1);
}

/**
 * Robust sampling disk around a point.
 * If mask provided, only accept pixels where mask indicates "person" enough.
 */
function sampleDisk(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  mask: Mask | null,
  maskThreshold: number
) {
  const r = Math.max(2, Math.floor(radius));
  const x0 = clamp(Math.floor(cx - r), 0, ctx.canvas.width - 1);
  const y0 = clamp(Math.floor(cy - r), 0, ctx.canvas.height - 1);
  const x1 = clamp(Math.floor(cx + r), 0, ctx.canvas.width - 1);
  const y1 = clamp(Math.floor(cy + r), 0, ctx.canvas.height - 1);

  const w = Math.max(1, x1 - x0 + 1);
  const h = Math.max(1, y1 - y0 + 1);

  const img = ctx.getImageData(x0, y0, w, h).data;
  const out: Array<{ r: number; g: number; b: number }> = [];

  const canvasW = ctx.canvas.width;
  const canvasH = ctx.canvas.height;

  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const px = x0 + xx;
      const py = y0 + yy;

      const dx = px - cx;
      const dy = py - cy;
      if (dx * dx + dy * dy > r * r) continue;

      if (mask) {
        const mv = maskValueAt(mask, canvasW, canvasH, px, py);
        if (mv < maskThreshold) continue;
      }

      const i = (yy * w + xx) * 4;
      const rr = img[i];
      const gg = img[i + 1];
      const bb = img[i + 2];
      const aa = img[i + 3];

      if (aa < 225) continue;

      const lum = (rr + gg + bb) / 3;
      if (lum < 28) continue;
      if (lum > 240) continue;

      out.push({ r: rr, g: gg, b: bb });
    }
  }

  return out;
}

// MediaPipe face mesh indices (468 points)
const REGION_POINTS = {
  forehead: [10, 9, 67, 297],
  leftCheek: [50, 101, 118, 205],
  rightCheek: [280, 330, 347, 425],
};

/**
 * Extract stable skin base hex from landmarks + canvas.
 * Uses:
 * - optional segmentation mask (person)
 * - landmark regions (face only)
 * - gray-world WB
 * - per-channel median
 */
export function extractSkinBaseHex(params: {
  ctx: CanvasRenderingContext2D;
  canvasW: number;
  canvasH: number;
  landmarks: Landmark[];
  mirrorX?: boolean;
  mask?: Mask | null;
}) {
  const { ctx, canvasW, canvasH, landmarks, mirrorX, mask } = params;

  const pts: Array<{ x: number; y: number }> = [];
  const add = (idx: number) => {
    const lm = landmarks[idx];
    if (!lm) return;
    const nx = mirrorX ? 1 - lm.x : lm.x;
    pts.push({ x: nx * canvasW, y: lm.y * canvasH });
  };

  for (const i of REGION_POINTS.forehead) add(i);
  for (const i of REGION_POINTS.leftCheek) add(i);
  for (const i of REGION_POINTS.rightCheek) add(i);

  if (pts.length < 6) {
    return { ok: false as const, hex: "#777777", reason: "no_landmarks" as const };
  }

  const a = pts[4];
  const b = pts[8] ?? pts[0];
  const faceScale = Math.hypot(a.x - b.x, a.y - b.y) || 140;

  const radius = clamp(faceScale * 0.03, 6, 22);

  const maskThreshold = mask ? 0.35 : 0.0;

  let samples: Array<{ r: number; g: number; b: number }> = [];
  for (const p of pts) {
    samples = samples.concat(sampleDisk(ctx, p.x, p.y, radius, mask ?? null, maskThreshold));
  }

  if (samples.length < 120) {
    if (mask) {
      let relaxed: Array<{ r: number; g: number; b: number }> = [];
      for (const p of pts) {
        relaxed = relaxed.concat(sampleDisk(ctx, p.x, p.y, radius, mask, 0.20));
      }
      if (relaxed.length >= 120) samples = relaxed;
    }
  }

  if (samples.length < 120) {
    return { ok: false as const, hex: "#777777", reason: "few_samples" as const, samples: samples.length };
  }

  const mids = samples.filter((s) => {
    const lum = (s.r + s.g + s.b) / 3;
    return lum > 45 && lum < 210;
  });

  const k = estimateGrayWorldMultipliers(mids.length ? mids : samples);
  const wb = samples.map((s) => applyWB(s, k));

  const rs = wb.map((s) => s.r);
  const gs = wb.map((s) => s.g);
  const bs = wb.map((s) => s.b);

  const r = median(rs);
  const g = median(gs);
  const b2 = median(bs);

  const hex = hexFromRGB(r, g, b2);
  return { ok: true as const, hex, sampleCount: samples.length };
}
export function computeFaceBoxFromLandmarks(
  landmarks: Landmark[],
  canvasW: number,
  canvasH: number,
  mirrorX?: boolean
): FaceBox {
  let minX = 1, minY = 1, maxX = 0, maxY = 0;

  for (const lm of landmarks) {
    const x = (mirrorX ? 1 - lm.x : lm.x);
    const y = lm.y;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  const x = minX * canvasW;
  const y = minY * canvasH;
  const w = (maxX - minX) * canvasW;
  const h = (maxY - minY) * canvasH;

  return { x, y, w, h };
}

export function isFacePlausible(
  face: FaceBox,
  canvasW: number,
  canvasH: number
) {
  // faccia troppo piccola = probabilmente non è un volto valido
  const area = face.w * face.h;
  const canvasArea = canvasW * canvasH;
  const areaRatio = area / canvasArea;

  // centro
  const cx = face.x + face.w / 2;
  const cy = face.y + face.h / 2;
  const dx = Math.abs(cx - canvasW / 2) / (canvasW / 2);
  const dy = Math.abs(cy - canvasH / 2) / (canvasH / 2);

  // soglie “safe”
  const okSize = areaRatio > 0.06;     // ~6% area (se vuoi più rigido: 0.08)
  const okCenter = dx < 0.55 && dy < 0.55;

  return { ok: okSize && okCenter, areaRatio, dx, dy };
}
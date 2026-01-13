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

// ✅ Singleton fileset
let _filesetPromise: Promise<VisionFileset> | null = null;

// ✅ Landmarker: 2 istanze separate (IMAGE + VIDEO)
let _landmarkerImage: FaceLandmarker | null = null;
let _landmarkerVideo: FaceLandmarker | null = null;

let _landmarkerImagePromise: Promise<FaceLandmarker> | null = null;
let _landmarkerVideoPromise: Promise<FaceLandmarker> | null = null;

// ✅ Segmenter singleton
let _segmenter: ImageSegmenter | null = null;
let _segmenterPromise: Promise<ImageSegmenter> | null = null;

// WASM base (downloaded once, runs locally)
const MP_WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

// Face model (.task)
const FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// Segmenter model (.tflite)
const SEGMENTER_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite";

  let _lastVideoTs = 0;
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

// ✅ reset helpers (anti “WASM stuck”)
function resetLandmarker(mode: "IMAGE" | "VIDEO") {
  if (mode === "IMAGE") {
    _landmarkerImage = null;
    _landmarkerImagePromise = null;
  } else {
    _landmarkerVideo = null;
    _landmarkerVideoPromise = null;
  }
}

function resetSegmenter() {
  _segmenter = null;
  _segmenterPromise = null;
}

/** Face Landmarker init (on-device WASM) — separate instances per mode */
export async function getFaceLandmarker(mode: "IMAGE" | "VIDEO"): Promise<FaceLandmarker> {
  if (mode === "IMAGE") {
    if (_landmarkerImage) return _landmarkerImage;
    if (_landmarkerImagePromise) return _landmarkerImagePromise;

    _landmarkerImagePromise = (async () => {
      try {
        const vision = await getFileset();
        const lm = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: FACE_MODEL_URL },
          numFaces: 1,
          runningMode: "IMAGE",
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        });
        _landmarkerImage = lm;
        return lm;
      } catch (e) {
        resetLandmarker("IMAGE");
        throw e;
      }
    })();

    return _landmarkerImagePromise;
  }

  // VIDEO
  if (_landmarkerVideo) return _landmarkerVideo;
  if (_landmarkerVideoPromise) return _landmarkerVideoPromise;

  _landmarkerVideoPromise = (async () => {
    try {
      const vision = await getFileset();
      const lm = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: FACE_MODEL_URL },
        numFaces: 1,
        runningMode: "VIDEO",
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });
      _landmarkerVideo = lm;
      return lm;
    } catch (e) {
      resetLandmarker("VIDEO");
      throw e;
    }
  })();

  return _landmarkerVideoPromise;
}

/** Image Segmenter init (on-device WASM) */
export async function getImageSegmenter(): Promise<ImageSegmenter> {
  if (_segmenter) return _segmenter;
  if (_segmenterPromise) return _segmenterPromise;

  _segmenterPromise = (async () => {
    try {
      const vision = await getFileset();
      const seg = await ImageSegmenter.createFromOptions(vision, {
        baseOptions: { modelAssetPath: SEGMENTER_MODEL_URL },
        runningMode: "IMAGE",
        outputCategoryMask: true,
        outputConfidenceMasks: false,
      });
      _segmenter = seg;
      return seg;
    } catch (e) {
      resetSegmenter();
      throw e;
    }
  })();

  return _segmenterPromise;
}

/** Detect face landmarks on IMAGE (canvas/image/bitmap) */
/** Detect face landmarks on IMAGE (canvas/image) — robust (no ImageBitmap) */
export async function detectFaceOnImage(
  input: HTMLCanvasElement | HTMLImageElement | ImageBitmap
) {
  const lm = await getFaceLandmarker("IMAGE");

  // ---- guard: input deve avere dimensioni valide ----
  const w =
    input instanceof HTMLImageElement
      ? input.naturalWidth
      : (input as any).width ?? 0;

  const h =
    input instanceof HTMLImageElement
      ? input.naturalHeight
      : (input as any).height ?? 0;

  if (!w || !h) return null;

  // ---- try 1: detect diretto (quando supportato) ----
  try {
    const res = lm.detect(input as any) as FaceLandmarkerResult;
    const face = res.faceLandmarks?.[0];
    if (!face?.length) return null;
    return face as Landmark[];
  } catch {
    // continua
  }

  // ---- try 2: se è un canvas, ripassa il canvas stesso (spesso più stabile) ----
  try {
    if (input instanceof HTMLCanvasElement) {
      const res = lm.detect(input as any) as FaceLandmarkerResult;
      const face = res.faceLandmarks?.[0];
      if (!face?.length) return null;
      return face as Landmark[];
    }
  } catch {
    // continua
  }

  // ---- try 3: fallback universale: ImageData ----
  try {
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const ctx = off.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    // reset transform (iOS/orientation safety)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (input instanceof HTMLImageElement) {
      ctx.drawImage(input, 0, 0, w, h);
    } else {
      // canvas o bitmap -> disegniamo comunque
      ctx.drawImage(input as any, 0, 0, w, h);
    }

    const imgData = ctx.getImageData(0, 0, w, h);
    const res = lm.detect(imgData as any) as FaceLandmarkerResult;
    const face = res.faceLandmarks?.[0];
    if (!face?.length) return null;
    return face as Landmark[];
  } catch {
    return null;
  }
}

/** Detect face landmarks on VIDEO */

export async function detectFaceOnVideo(video: HTMLVideoElement, timestampMs: number) {
  try {
    const lm = await getFaceLandmarker("VIDEO");

    // ✅ guard: video pronto
    if (!video.videoWidth || !video.videoHeight) return null;
    if (video.readyState < 2) return null; // HAVE_CURRENT_DATA

    // ✅ timestamp SEMPRE monotono (MediaPipe VIDEO lo pretende)
    const raw = Number.isFinite(timestampMs) ? timestampMs : performance.now();
    const t = Math.max(raw, _lastVideoTs + 1);
    _lastVideoTs = t;

    const res = lm.detectForVideo(video, t) as FaceLandmarkerResult;
    const face = res.faceLandmarks?.[0];
    if (!face?.length) return null;

    return face as Landmark[];
  } catch (e) {
    // ✅ evita overlay error in dev
    return null;
  }
}

type Mask = { w: number; h: number; data: Float32Array | Uint8Array };

/** Segment person mask on IMAGE (canvas/image/bitmap) */
export async function segmentPersonOnImage(input: HTMLCanvasElement | HTMLImageElement | ImageBitmap) {
  // guard: dimensioni valide
  const w = input instanceof HTMLImageElement ? input.naturalWidth : (input as any).width ?? 0;
  const h = input instanceof HTMLImageElement ? input.naturalHeight : (input as any).height ?? 0;
  if (!w || !h) return null;

  let seg: ImageSegmenter;
  try {
    seg = await getImageSegmenter();
  } catch {
    resetSegmenter();
    return null;
  }

  // ✅ sempre ImageBitmap
  let bmp: ImageBitmap | null = null;
  try {
    bmp = input instanceof ImageBitmap ? input : await createImageBitmap(input as any);
  } catch {
    bmp = null;
  }
  if (!bmp) return null;

  let res: ImageSegmenterResult | null = null;
  try {
    res = seg.segment(bmp as any) as ImageSegmenterResult;
  } catch {
    resetSegmenter();
    res = null;
  }
  if (!res) return null;

  const mask = res.categoryMask;
  if (!mask) return null;

  const mw = (mask as any).width ?? (bmp as any).width ?? 0;
  const mh = (mask as any).height ?? (bmp as any).height ?? 0;

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

  return { w: mw, h: mh, data };
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

/** Get mask value (0..1) mapping canvas coords -> mask coords */
function maskValueAt(mask: Mask, canvasW: number, canvasH: number, x: number, y: number) {
  const mx = clamp(Math.round((x / canvasW) * (mask.w - 1)), 0, mask.w - 1);
  const my = clamp(Math.round((y / canvasH) * (mask.h - 1)), 0, mask.h - 1);
  const idx = my * mask.w + mx;

  const v = mask.data[idx];
  if (mask.data instanceof Uint8Array) return v / 255;
  return clamp(v, 0, 1);
}

/** Sampling disk */
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
// ✅ più permissivo: include pelle scura ed evita solo nero totale / bianco bruciato
if (lum < 10) continue;
if (lum > 248) continue;

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
export function extractSkinHexForRegions(params: {
  ctx: CanvasRenderingContext2D;
  canvasW: number;
  canvasH: number;
  landmarks: Landmark[];
  regions: Array<"forehead" | "leftCheek" | "rightCheek">;
  mirrorX?: boolean;
  mask?: any | null;
  applyWhiteBalance?: boolean;
}) {
  const { ctx, canvasW, canvasH, landmarks, regions, mirrorX, mask, applyWhiteBalance = true } = params;

  const pts: Array<{ x: number; y: number }> = [];
  const add = (idx: number) => {
    const lm = landmarks[idx];
    if (!lm) return;
    const nx = mirrorX ? 1 - lm.x : lm.x;
    pts.push({ x: nx * canvasW, y: lm.y * canvasH });
  };

  for (const region of regions) {
    const arr = (REGION_POINTS as any)[region] as number[] | undefined;
    if (!arr) continue;
    for (const i of arr) add(i);
  }

  if (pts.length < 4) {
    return { ok: false as const, hex: "#777777", reason: "no_points" as const };
  }

  // stima scala volto
  const a = pts[0];
  const b = pts[pts.length - 1];
  const faceScale = Math.hypot(a.x - b.x, a.y - b.y) || 140;
  const radius = clamp(faceScale * 0.03, 6, 22);

  const maskThreshold = mask ? 0.22 : 0.0;

  let samples: Array<{ r: number; g: number; b: number }> = [];
  for (const p of pts) {
    samples = samples.concat(sampleDisk(ctx, p.x, p.y, radius, mask ?? null, maskThreshold));
  }

  if (samples.length < 120 && mask) {
    let relaxed: Array<{ r: number; g: number; b: number }> = [];
    for (const p of pts) {
      relaxed = relaxed.concat(sampleDisk(ctx, p.x, p.y, radius, mask, 0.12));
    }
    if (relaxed.length >= 120) samples = relaxed;
  }

  if (samples.length < 120) {
    return { ok: false as const, hex: "#777777", reason: "few_samples" as const, samples: samples.length };
  }

  // ✅ lum più permissivo (include pelle scura)
  const mids = samples.filter((s) => {
    const lum = (s.r + s.g + s.b) / 3;
    return lum > 18 && lum < 235;
  });

  const wb = applyWhiteBalance
    ? samples.map((s) => applyWB(s, estimateGrayWorldMultipliers(mids.length ? mids : samples)))
    : samples;

  const rs = wb.map((s) => s.r);
  const gs = wb.map((s) => s.g);
  const bs = wb.map((s) => s.b);

  const r = median(rs);
  const g = median(gs);
  const b2 = median(bs);

  const hex = hexFromRGB(r, g, b2);
  return { ok: true as const, hex, sampleCount: samples.length };
}
export function extractSkinBaseHex(params: {
  ctx: CanvasRenderingContext2D;
  canvasW: number;
  canvasH: number;
  landmarks: Landmark[];
  mirrorX?: boolean;
  mask?: Mask | null;
  applyWhiteBalance?: boolean;
}) {
  const { ctx, canvasW, canvasH, landmarks, mirrorX, mask, applyWhiteBalance = true } = params;

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

  if (samples.length < 120 && mask) {
    let relaxed: Array<{ r: number; g: number; b: number }> = [];
    for (const p of pts) {
      relaxed = relaxed.concat(sampleDisk(ctx, p.x, p.y, radius, mask, 0.2));
    }
    if (relaxed.length >= 120) samples = relaxed;
  }

  if (samples.length < 120) {
    return { ok: false as const, hex: "#777777", reason: "few_samples" as const, samples: samples.length };
  }

  const mids = samples.filter((s) => {
  const lum = (s.r + s.g + s.b) / 3;
  // ✅ include pelle scura e non elimina troppo
  return lum > 18 && lum < 235;
});

  const wb = applyWhiteBalance
  ? samples.map((s) => applyWB(s, estimateGrayWorldMultipliers(mids.length ? mids : samples)))
  : samples;

  const rs = wb.map((s) => s.r);
  const gs = wb.map((s) => s.g);
  const bs = wb.map((s) => s.b);

  const r = median(rs);
  const g = median(gs);
  const b2 = median(bs);

  const hex = hexFromRGB(r, g, b2);
  return { ok: true as const, hex, sampleCount: samples.length };
}

export function computeFaceBoxFromLandmarks(landmarks: Landmark[], canvasW: number, canvasH: number, mirrorX?: boolean): FaceBox {
  let minX = 1,
    minY = 1,
    maxX = 0,
    maxY = 0;

  for (const lm of landmarks) {
    const x = mirrorX ? 1 - lm.x : lm.x;
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

export function isFacePlausible(face: FaceBox, canvasW: number, canvasH: number) {
  const area = face.w * face.h;
  const canvasArea = canvasW * canvasH;
  const areaRatio = area / canvasArea;

  const cx = face.x + face.w / 2;
  const cy = face.y + face.h / 2;
  const dx = Math.abs(cx - canvasW / 2) / (canvasW / 2);
  const dy = Math.abs(cy - canvasH / 2) / (canvasH / 2);

  const okSize = areaRatio > 0.06;
  const okCenter = dx < 0.55 && dy < 0.55;

  return { ok: okSize && okCenter, areaRatio, dx, dy };
}
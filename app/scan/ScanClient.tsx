// app/scan/ScanClient.tsx
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { trackEvent } from "@/app/lib/telemetry";
import { type PaletteItem, makePaletteFromSamples } from "@/app/lib/paletteLogic";
import { getStyleInsight } from "@/app/lib/paletteLogic";
import type { BrandStyle } from "@/app/lib/paletteLibrary";

// ✅ MediaPipe on-device engine
import {
  detectFaceOnVideo,
  detectFaceOnImage,
  segmentPersonOnImage,
  extractSkinBaseHex,
  extractSkinHexForRegions,
  type Landmark,
  type FaceBox as MPFaceBox,
} from "@/app/lib/faceEngine";

declare global {
  interface Window {
    ttq?: any;
  }
}

/* ---------------- TikTok Pixel helper ---------------- */
function trackTT(event: string, data: Record<string, any> = {}) {
  try {
    if (typeof window !== "undefined" && window.ttq) window.ttq.track(event, data);
  } catch {
    // ignore
  }
}

/* ---------------- Camera error explain ---------------- */
function explainCamError(err: any) {
  const name = String(err?.name || "");
  const msg = String(err?.message || "");
  console.error("getUserMedia ERROR:", { name, msg, err });

  if (name === "NotAllowedError" || name === "SecurityError") return "NOT_ALLOWED";
  if (name === "NotFoundError") return "NO_CAMERA";
  if (name === "NotReadableError") return "BUSY";
  if (name === "OverconstrainedError") return "CONSTRAINTS";
  return `RAW:${name}:${msg}`;
}

/* ---------------- Types ---------------- */
type RitualState = "idle" | "calibrating" | "error" | "loading";

type ScanMeta = {
  method: "camera" | "upload";
  confidence: number; // 0..100
  undertone: "warm" | "cool" | "neutral";
  depth: "light" | "medium" | "deep";
  lab: { L: number; a: number; b: number };
  sampleCount: number;
  quality: number; // 0..100
};

const BRAND = "UNYFORM"; // (se vuoi, cambia qui il brand visible)
const LAST_KEY = "beorganich:lastPalette:v1";

/* ---------------- Fallback RAM ---------------- */
let MEMORY_LAST: PaletteItem[] | null = null;

/* ---------------- Persist ---------------- */
function saveLastPalette(
  pal: PaletteItem[],
  meta: ScanMeta,
  stableHex?: string,
  samples?: string[]
) {
  MEMORY_LAST = pal;

  // ✅ deduci stile e testi premium (per Result)
  const bestStyle = deriveBestStyleFromPalette(pal);
  const insight = getStyleInsight(bestStyle);

  try {
    localStorage.setItem(
      LAST_KEY,
      JSON.stringify({
        ts: Date.now(),
        palette: pal,
        meta: {
          ...meta,
          style: bestStyle,           // ✅ utile anche per debug
          styleName: insight.displayName, // ✅ quello che vuoi mostrare
        },
        // ✅ campi “Result-ready”
        styleName: insight.displayName,
        styleTag: "stile dominante",
        headline: insight.title,
        subcopy: insight.subtitle,

        stableHex: stableHex ?? null,
        samples: samples ?? null,
      })
    );
  } catch {
    // ignore
  }
}
/* ---------------- Utils ---------------- */
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/* ---------------- Local color math (robust + fast, no imports) ---------------- */
function normalizeHexLocal(hex: string) {
  const h = (hex || "").trim();
  if (!h) return "#777777";
  if (h.startsWith("#")) return h.length === 7 ? h.toUpperCase() : "#777777";
  return h.length === 6 ? `#${h.toUpperCase()}` : "#777777";
}
function hexToRgbLocal(hex: string) {
  const h = normalizeHexLocal(hex).replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16) || 0,
    g: parseInt(h.slice(2, 4), 16) || 0,
    b: parseInt(h.slice(4, 6), 16) || 0,
  };
}
function srgbToLin(v: number) {
  const x = v / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}
function rgbToXyz(r: number, g: number, b: number) {
  const R = srgbToLin(r);
  const G = srgbToLin(g);
  const B = srgbToLin(b);
  return {
    X: R * 0.4124 + G * 0.3576 + B * 0.1805,
    Y: R * 0.2126 + G * 0.7152 + B * 0.0722,
    Z: R * 0.0193 + G * 0.1192 + B * 0.9505,
  };
}
function fLab(t: number) {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}
function xyzToLab(X: number, Y: number, Z: number) {
  const Xn = 0.95047,
    Yn = 1.0,
    Zn = 1.08883;
  const fx = fLab(X / Xn);
  const fy = fLab(Y / Yn);
  const fz = fLab(Z / Zn);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}
function hexToLabLocal(hex: string) {
  const { r, g, b } = hexToRgbLocal(hex);
  const { X, Y, Z } = rgbToXyz(r, g, b);
  return xyzToLab(X, Y, Z);
}
function deltaELocal(l1: { L: number; a: number; b: number }, l2: { L: number; a: number; b: number }) {
  return Math.hypot(l1.L - l2.L, l1.a - l2.a, l1.b - l2.b);
}
function deriveBestStyleFromPalette(pal: PaletteItem[]): BrandStyle {
  const votes: Record<any, number> = {
    "NOIR ICON": 0,
    "SAND LUXE": 0,
    "SAGE MODERN": 0,
    "ICE ROYAL": 0,
  };

  for (const c of pal) {
    if (c.style && votes[c.style] != null) votes[c.style] += 1;
  }

  let best: BrandStyle = "SAND LUXE";
  (Object.keys(votes) as BrandStyle[]).forEach((s) => {
    if (votes[s] > votes[best]) best = s;
  });

  return best;
}

/* ---------------- Signals + Confidence ---------------- */
function getSkinSignalsFromHex(hex: string) {
  const lab = hexToLabLocal(hex);
  const L = lab.L;
  const a = lab.a;
  const b = lab.b;

  const undertone: "warm" | "cool" | "neutral" = b >= 9 ? "warm" : b <= -6 ? "cool" : "neutral";
  const depth: "light" | "medium" | "deep" = L >= 72 ? "light" : L <= 46 ? "deep" : "medium";

  return {
    undertone,
    depth,
    lab: { L: Math.round(L), a: Math.round(a), b: Math.round(b) },
  };
}

function computeConfidenceFromHexes(params: { stableHex: string; hexes: string[]; quality01: number }) {
  const { stableHex, hexes, quality01 } = params;

  const base = hexToLabLocal(stableHex);
  const ds = hexes
    .map((h) => {
      try {
        return deltaELocal(base, hexToLabLocal(h));
      } catch {
        return 999;
      }
    })
    .filter((d) => Number.isFinite(d) && d < 999);

  const avgDE = ds.length ? ds.reduce((x, y) => x + y, 0) / ds.length : 99;
  const stability01 = clamp01(1 - avgDE / 16); // più severo = più qualità
  const count01 = clamp01(hexes.length / 30);

  const conf01 = clamp01(0.46 * quality01 + 0.36 * stability01 + 0.18 * count01);
  return { confidence: Math.round(conf01 * 100), avgDE: Math.round(avgDE * 10) / 10 };
}

/* ---------------- Stable hex (median in Lab) ---------------- */
function medianNum(arr: number[]) {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

function pickStableHex(hexes: string[]) {
  if (!hexes.length) return "#777777";

  // 1) normalize
  const norm = hexes.map((h) => normalizeHexLocal(h)).filter((h) => h !== "#777777");

  if (!norm.length) return "#777777";

  // 2) robust median in Lab
  const labs = norm.map((h) => ({ h, lab: hexToLabLocal(h) }));
  const Lm = medianNum(labs.map((x) => x.lab.L));
  const am = medianNum(labs.map((x) => x.lab.a));
  const bm = medianNum(labs.map((x) => x.lab.b));

  let best = labs[0].h;
  let bestD = Infinity;

  for (const x of labs) {
    const d = Math.hypot(x.lab.L - Lm, x.lab.a - am, x.lab.b - bm);
    if (d < bestD) {
      bestD = d;
      best = x.h;
    }
  }
  return best;
}

/* ---------------- Image compress (upload stability) ---------------- */
async function compressImageToWebP(file: File, opts: { maxSide?: number; quality?: number } = {}) {
  const maxSide = opts.maxSide ?? 1600;
  const quality = opts.quality ?? 0.84;

  let bmp: ImageBitmap | null = null;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as any);
  } catch {
    bmp = null;
  }

  let w = 0;
  let h = 0;
  let drawSource: CanvasImageSource;

  if (bmp) {
    w = bmp.width;
    h = bmp.height;
    drawSource = bmp;
  } else {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode().catch(() => {});
      w = img.naturalWidth;
      h = img.naturalHeight;
      drawSource = img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const scale = Math.min(1, maxSide / Math.max(w, h));
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));

  const off = document.createElement("canvas");
  off.width = tw;
  off.height = th;

  const ctx = off.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas non disponibile");

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, tw, th);
  ctx.drawImage(drawSource, 0, 0, tw, th);

  const blob: Blob = await new Promise((resolve, reject) => {
    off.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/webp", quality);
  });

  return blob;
}

/* ---------------- Canvas draw (camera mirror) ---------------- */
function drawMirrorToCanvas(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return false;

  canvas.width = vw;
  canvas.height = vh;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;

  ctx.save();
  ctx.translate(vw, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, vw, vh);
  ctx.restore();

  return true;
}

/* ---------------- Quality metrics ---------------- */
function sampleRGB(ctx: CanvasRenderingContext2D, x: number, y: number, box: number) {
  const xx = Math.floor(x - box / 2);
  const yy = Math.floor(y - box / 2);
  const w = Math.max(2, Math.floor(box));
  const h = Math.max(2, Math.floor(box));

  const cx = clamp(xx, 0, ctx.canvas.width - w);
  const cy = clamp(yy, 0, ctx.canvas.height - h);

  const data = ctx.getImageData(cx, cy, w, h).data;
  let r = 0,
    g = 0,
    b = 0,
    count = 0;

  for (let i = 0; i < data.length; i += 4) {
    const rr = data[i];
    const gg = data[i + 1];
    const bb = data[i + 2];
    const aa = data[i + 3];

    if (aa < 210) continue;
    const lum = (rr + gg + bb) / 3;
    if (lum < 22) continue;

    r += rr;
    g += gg;
    b += bb;
    count++;
  }

  if (!count) return { r: 0, g: 0, b: 0, ok: false };
  return { r: r / count, g: g / count, b: b / count, ok: true };
}

function computeQuality(ctx: CanvasRenderingContext2D, face: MPFaceBox) {
  const cx = face.x + face.w / 2;
  const cy = face.y + face.h / 2;
  const s = Math.min(face.w, face.h) * 0.22;

  const p1 = sampleRGB(ctx, cx, cy, s);
  const p2 = sampleRGB(ctx, cx - s * 0.5, cy - s * 0.3, s * 0.7);
  const p3 = sampleRGB(ctx, cx + s * 0.5, cy - s * 0.3, s * 0.7);
  const p4 = sampleRGB(ctx, cx, cy + s * 0.45, s * 0.8);

  const arr = [p1, p2, p3, p4].filter((p) => p.ok);
  if (arr.length < 2) return { score: 0, hint: "Più luce naturale." };

  const lums = arr.map((p) => (p.r + p.g + p.b) / 3);
  const avg = lums.reduce((a, b) => a + b, 0) / lums.length;
  const varr = lums.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / lums.length;
  const std = Math.sqrt(varr);

  const brightness = clamp(avg / 220, 0, 1);
  const contrast = clamp(std / 40, 0, 1);
  const score = clamp(0.55 * brightness + 0.45 * contrast, 0, 1);

  let hint = "Perfetto.";
  if (brightness < 0.35) hint = "Più luce naturale.";
  else if (contrast < 0.25) hint = "Rimani fermo e avvicinati al cerchio.";

  return { score, hint };
}

function guidanceFromFace(face: MPFaceBox, W: number, H: number) {
  const cx = face.x + face.w / 2;
  const cy = face.y + face.h / 2;

  const nx = (cx - W / 2) / (W / 2);
  const ny = (cy - H / 2) / (H / 2);
  const size = face.w / Math.min(W, H);

  const msgs: string[] = [];
  if (ny < -0.15) msgs.push("Sposta il viso un po’ più giù.");
  if (ny > 0.18) msgs.push("Sposta il viso un po’ più su.");
  if (nx < -0.18) msgs.push("Sposta il viso un po’ a destra.");
  if (nx > 0.18) msgs.push("Sposta il viso un po’ a sinistra.");
  if (size < 0.22) msgs.push("Avvicinati un po’.");
  if (size > 0.48) msgs.push("Allontanati un po’.");

  return msgs[0] ?? "Centro perfetto. Resta fermo.";
}

/* --------- Landmark -> FaceBox + plausibility --------- */
function computeFaceBoxFromLandmarks(landmarks: Landmark[], canvasW: number, canvasH: number, mirrorX?: boolean) {
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

  minX = clamp(minX, 0, 1);
  minY = clamp(minY, 0, 1);
  maxX = clamp(maxX, 0, 1);
  maxY = clamp(maxY, 0, 1);

  const x = minX * canvasW;
  const y = minY * canvasH;
  const w = (maxX - minX) * canvasW;
  const h = (maxY - minY) * canvasH;

  return { x, y, w, h };
}

function isFacePlausible(face: MPFaceBox, canvasW: number, canvasH: number) {
  const area = face.w * face.h;
  const canvasArea = canvasW * canvasH;
  const areaRatio = canvasArea ? area / canvasArea : 0;

  const okArea = areaRatio > 0.06 && areaRatio < 0.7;

  const cx = face.x + face.w / 2;
  const cy = face.y + face.h / 2;
  const dx = Math.abs(cx - canvasW / 2) / (canvasW / 2);
  const dy = Math.abs(cy - canvasH / 2) / (canvasH / 2);
  const okCenter = dx < 0.62 && dy < 0.62;

  const aspect = face.w > 0 ? face.h / face.w : 0;
  const okAspect = aspect >= 0.55 && aspect <= 1.85;

  const okPx = face.w >= 120 && face.h >= 120;

  return { ok: okArea && okCenter && okAspect && okPx };
}

/* ---------------- Landmark plausibility (fast) ---------------- */
const IDX = {
  leftEyeOuter: 33,
  leftEyeInner: 133,
  rightEyeInner: 362,
  rightEyeOuter: 263,
  noseTip: 1,
  mouthUpper: 13,
  mouthLower: 14,
};

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function lmPx(lm: Landmark, W: number, H: number, mirrorX?: boolean) {
  const nx = mirrorX ? 1 - lm.x : lm.x;
  return { x: nx * W, y: lm.y * H };
}
function isLandmarksPlausible(landmarks: Landmark[], W: number, H: number, mirrorX?: boolean) {
  const leO = landmarks[IDX.leftEyeOuter];
  const leI = landmarks[IDX.leftEyeInner];
  const reI = landmarks[IDX.rightEyeInner];
  const reO = landmarks[IDX.rightEyeOuter];
  const nose = landmarks[IDX.noseTip];
  const mu = landmarks[IDX.mouthUpper];
  const ml = landmarks[IDX.mouthLower];

  if (!leO || !leI || !reI || !reO || !nose || !mu || !ml) return { ok: false as const };

  const p_leO = lmPx(leO, W, H, mirrorX);
  const p_leI = lmPx(leI, W, H, mirrorX);
  const p_reI = lmPx(reI, W, H, mirrorX);
  const p_reO = lmPx(reO, W, H, mirrorX);
  const p_nose = lmPx(nose, W, H, mirrorX);
  const p_mu = lmPx(mu, W, H, mirrorX);
  const p_ml = lmPx(ml, W, H, mirrorX);

  const eyeSpan = dist(p_leO, p_reO);
  const leftEyeW = dist(p_leO, p_leI);
  const rightEyeW = dist(p_reO, p_reI);
  const eyeW = (leftEyeW + rightEyeW) / 2;

  const mouthY = (p_mu.y + p_ml.y) / 2;
  const eyeY = (p_leO.y + p_reO.y) / 2;
  const noseToMouth = Math.abs(mouthY - p_nose.y);
  const eyeToNose = Math.abs(p_nose.y - eyeY);

  if (eyeSpan < 70) return { ok: false as const };
  const eyeRatio = eyeW / eyeSpan;
  if (eyeRatio < 0.12 || eyeRatio > 0.38) return { ok: false as const };

  const vertRatio = eyeToNose > 1 ? noseToMouth / eyeToNose : 0;
  if (vertRatio < 0.35 || vertRatio > 2.2) return { ok: false as const };

  const eyeMidX = (p_leO.x + p_reO.x) / 2;
  const dx = Math.abs(p_nose.x - eyeMidX) / (eyeSpan / 2);
  if (dx > 0.9) return { ok: false as const };

  return { ok: true as const };
}

/* ---------------- Sharpness + Motion (premium) ---------------- */
function computeSharpness(ctx: CanvasRenderingContext2D, face: MPFaceBox) {
  const pad = 0.18;
  const x0 = clamp(Math.floor(face.x + face.w * pad), 0, ctx.canvas.width - 1);
  const y0 = clamp(Math.floor(face.y + face.h * pad), 0, ctx.canvas.height - 1);
  const x1 = clamp(Math.floor(face.x + face.w * (1 - pad)), 0, ctx.canvas.width - 1);
  const y1 = clamp(Math.floor(face.y + face.h * (1 - pad)), 0, ctx.canvas.height - 1);

  const w = Math.max(16, x1 - x0);
  const h = Math.max(16, y1 - y0);

  const ds = 2;
  const W = Math.floor(w / ds);
  const H = Math.floor(h / ds);

  const img = ctx.getImageData(x0, y0, w, h).data;
  const g = new Float32Array(W * H);

  for (let yy = 0; yy < H; yy++) {
    for (let xx = 0; xx < W; xx++) {
      const sx = xx * ds;
      const sy = yy * ds;
      const i = (sy * w + sx) * 4;
      const r = img[i],
        gg = img[i + 1],
        b = img[i + 2];
      g[yy * W + xx] = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
    }
  }

  let sum = 0;
  let sum2 = 0;
  let n = 0;

  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const c = g[y * W + x];
      const lap = -4 * c + g[y * W + (x - 1)] + g[y * W + (x + 1)] + g[(y - 1) * W + x] + g[(y + 1) * W + x];
      sum += lap;
      sum2 += lap * lap;
      n++;
    }
  }

  if (!n) return 0;
  const mean = sum / n;
  const varr = sum2 / n - mean * mean;
  return Math.max(0, varr);
}

function computeMotionScore(
  ctx: CanvasRenderingContext2D,
  face: MPFaceBox,
  prevRef: React.MutableRefObject<Float32Array | null>
) {
  const pad = 0.26;
  const x0 = clamp(Math.floor(face.x + face.w * pad), 0, ctx.canvas.width - 1);
  const y0 = clamp(Math.floor(face.y + face.h * pad), 0, ctx.canvas.height - 1);
  const x1 = clamp(Math.floor(face.x + face.w * (1 - pad)), 0, ctx.canvas.width - 1);
  const y1 = clamp(Math.floor(face.y + face.h * (1 - pad)), 0, ctx.canvas.height - 1);

  const w = Math.max(20, x1 - x0);
  const h = Math.max(20, y1 - y0);

  const ds = 4;
  const W = Math.floor(w / ds);
  const H = Math.floor(h / ds);

  const img = ctx.getImageData(x0, y0, w, h).data;
  const cur = new Float32Array(W * H);

  for (let yy = 0; yy < H; yy++) {
    for (let xx = 0; xx < W; xx++) {
      const sx = xx * ds;
      const sy = yy * ds;
      const i = (sy * w + sx) * 4;
      const r = img[i],
        gg = img[i + 1],
        b = img[i + 2];
      cur[yy * W + xx] = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
    }
  }

  const prev = prevRef.current;
  prevRef.current = cur;

  if (!prev || prev.length !== cur.length) return 0;

  let diff = 0;
  for (let i = 0; i < cur.length; i++) diff += Math.abs(cur[i] - prev[i]);
  diff /= cur.length;

  return clamp(1 - diff / 10, 0, 1);
}

/* ---------------- Component ---------------- */
export default function ScanPage() {
  const router = useRouter();
  const params = useSearchParams();
  const debug = params.get("debug") === "1";

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scanAnchorRef = useRef<HTMLDivElement | null>(null);

  const [ritual, setRitual] = useState<RitualState>("idle");
  const [quality, setQuality] = useState(0);
  const [qualityHint, setQualityHint] = useState("Analisi discreta. Nessuna foto salvata.");
  const [lastFailReason, setLastFailReason] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [scanFull, setScanFull] = useState(false);

  const goodFramesRef = useRef(0);
  const smoothedQualityRef = useRef(0);
  const stableHexesRef = useRef<string[]>([]);
  const lastStableSampleAtRef = useRef(0);
  const prevMotionRef = useRef<Float32Array | null>(null);

  // ✅ soglia quality
  const THRESHOLD = 0.66;

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {}
      videoRef.current.srcObject = null;
    }

    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) {
        try {
          t.stop();
        } catch {}
      }
      streamRef.current = null;
    }
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const scrollToScan = useCallback(() => {
    const el = scanAnchorRef.current || document.getElementById("scan");
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
    });
  }, []);

  const startCamera = useCallback(async () => {
    // internal analytics
    trackEvent("StartScan", { method: "camera" }, "/scan");
    // TikTok
    trackTT("StartScan", { method: "camera" });

    setScanFull(false);
    stopCamera();

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
    } catch (err) {
      throw new Error(explainCamError(err));
    }

    streamRef.current = stream;
    const v = videoRef.current;
    if (!v) throw new Error("Video ref missing");
    v.srcObject = stream;

    // iOS/Safari: play può fallire se non è user gesture, ma noi lo chiamiamo su click
    await v.play();
  }, [stopCamera]);

  const runTick = useCallback(async () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;

    if (!v.videoWidth || !v.videoHeight) {
      rafRef.current = requestAnimationFrame(runTick);
      return;
    }

    const ok = drawMirrorToCanvas(v, c);
    if (!ok) {
      rafRef.current = requestAnimationFrame(runTick);
      return;
    }

    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      rafRef.current = requestAnimationFrame(runTick);
      return;
    }

    // throttle detect
    const tickCounter = (runTick as any)._c ?? 0;
    (runTick as any)._c = tickCounter + 1;
    const doDetect = tickCounter % 3 === 0;

    let landmarks: Landmark[] | null = null;
    if (doDetect) {
      try {
        landmarks = await detectFaceOnVideo(v, performance.now());
      } catch {
        landmarks = null;
      }
      (runTick as any)._lm = landmarks;
    } else {
      landmarks = (runTick as any)._lm ?? null;
    }

    if (!landmarks?.length) {
      setQualityHint("Non vedo un volto. Avvicinati e resta al centro.");
      setQuality(0);
      goodFramesRef.current = 0;
      stableHexesRef.current = [];
      rafRef.current = requestAnimationFrame(runTick);
      return;
    }

    // ✅ canvas è GIÀ mirrorato -> mirrorX = false per box/sampling coerente
    const faceBox = computeFaceBoxFromLandmarks(landmarks, c.width, c.height, false);
    const plaus = isFacePlausible(faceBox, c.width, c.height);
    const plaus2 = isLandmarksPlausible(landmarks, c.width, c.height, false);

    if (!plaus.ok || !plaus2.ok) {
      setQualityHint("Volto non stabile. Frontale, centrato, luce naturale.");
      setQuality(0);
      goodFramesRef.current = 0;
      stableHexesRef.current = [];
      rafRef.current = requestAnimationFrame(runTick);
      return;
    }

    const qBase = computeQuality(ctx, faceBox);
    const sharp = computeSharpness(ctx, faceBox);
    const sharpScore = clamp(sharp / 220, 0, 1);
    const motionScore = computeMotionScore(ctx, faceBox, prevMotionRef);

    const combined = clamp(0.42 * qBase.score + 0.33 * sharpScore + 0.25 * motionScore, 0, 1);

    smoothedQualityRef.current = lerp(smoothedQualityRef.current, combined, 0.18);
    const smooth = smoothedQualityRef.current;

    setQuality(smooth);

    const hint = smooth >= 0.55 ? qBase.hint : guidanceFromFace(faceBox, c.width, c.height);
    setQualityHint(hint);

    // ✅ premium sampling: 3 regioni + white balance + window più ampia
    if (smooth >= THRESHOLD) {
      goodFramesRef.current += 1;

      const now = performance.now();
      if (now - lastStableSampleAtRef.current > 170) {
        lastStableSampleAtRef.current = now;

        const regions = ["forehead", "leftCheek", "rightCheek"] as const;

        for (const region of regions) {
          const r = extractSkinHexForRegions({
            ctx,
            canvasW: c.width,
            canvasH: c.height,
            landmarks,
            mirrorX: false, // ✅ FIX: canvas già mirrorato
            mask: null,
            applyWhiteBalance: true,
            regions: [region as any],
          });

          if (r.ok) {
            stableHexesRef.current.push(r.hex);
            if (stableHexesRef.current.length > 36) stableHexesRef.current.shift();
          }
        }

        // fallback “base” se le regioni falliscono (mai 100% affidabile, ma salva sessioni)
        if (stableHexesRef.current.length < 6) {
          const skin = extractSkinBaseHex({
            ctx,
            canvasW: c.width,
            canvasH: c.height,
            landmarks,
            mirrorX: false,
            mask: null,
          });
          if (skin.ok) stableHexesRef.current.push(skin.hex);
        }
      }
    } else {
      goodFramesRef.current = 0;
      stableHexesRef.current = [];
    }

    // ✅ FINALIZE LIVE: più severo per evitare “sempre uguale”
    if (goodFramesRef.current >= 10 && stableHexesRef.current.length >= 18) {
      goodFramesRef.current = 0;

      const stableHex = pickStableHex(stableHexesRef.current);
      if (!stableHex || stableHex === "#777777") {
        setQualityHint("Non riesco a leggere bene la pelle. Più luce naturale, niente filtri.");
        rafRef.current = requestAnimationFrame(runTick);
        return;
      }
console.log("🟢 STABLE HEX:", stableHex);
console.log("🟡 ALL HEXES:", [...stableHexesRef.current]);
      const pal = makePaletteFromSamples(stableHex);

      const signals = getSkinSignalsFromHex(stableHex);
      const conf = computeConfidenceFromHexes({
        stableHex,
        hexes: stableHexesRef.current,
        quality01: smooth,
      });

      const meta: ScanMeta = {
        method: "camera",
        confidence: conf.confidence,
        undertone: signals.undertone,
        depth: signals.depth,
        lab: signals.lab,
        sampleCount: stableHexesRef.current.length,
        quality: Math.round(smooth * 100),
      };

      saveLastPalette(pal, meta, stableHex, stableHexesRef.current.slice(-24));

      // TikTok Pixel
      trackTT("ScanCompleted", {
        method: meta.method,
        confidence: meta.confidence,
        quality: meta.quality,
        undertone: meta.undertone,
        depth: meta.depth,
        samples: meta.sampleCount,
      });

      // Internal telemetry
      trackEvent(
        "ScanCompleted",
        {
          method: meta.method,
          confidence: meta.confidence,
          quality: meta.quality,
          undertone: meta.undertone,
          depth: meta.depth,
          samples: meta.sampleCount,
        },
        "/scan"
      );

      stopCamera();
      router.push(`/result?ts=${Date.now()}`);
      return;
    }

    rafRef.current = requestAnimationFrame(runTick);
  }, [router, stopCamera]);

  const startRitual = useCallback(async () => {
    setLastFailReason(null);
    setRitual("loading");
    setQuality(0);

    smoothedQualityRef.current = 0;
    goodFramesRef.current = 0;
    stableHexesRef.current = [];
    lastStableSampleAtRef.current = 0;
    prevMotionRef.current = null;

    try {
      setQualityHint("Carico il motore… (solo la prima volta)");
      await startCamera();

      setScanFull(true);
      scrollToScan();
      setRitual("calibrating");
      setQualityHint("Resta al centro. Un secondo di calma. Poi… magia.");

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(runTick);
    } catch (e: any) {
      const code = String(e?.message || "");

      if (code.startsWith("RAW:")) {
        const raw = code.slice(4);
        setLastFailReason(`Errore camera: ${raw}`);
        setRitual("error");
        return;
      }

      const map: Record<string, string> = {
        NOT_ALLOWED: "Permesso camera negato. Clicca 🔒 nella barra e abilita la camera.",
        NO_CAMERA: "Nessuna camera trovata su questo dispositivo.",
        BUSY: "La camera è in uso da un’altra app/tab (Zoom/Meet/Teams). Chiudi e riprova.",
        CONSTRAINTS: "Impostazioni camera non supportate. Ricarica la pagina.",
      };

      setLastFailReason(map[code] ?? "Non riesco ad aprire la camera. Ricarica o usa ‘Carica una foto’. ");
      setRitual("error");
    }
  }, [runTick, scrollToScan, startCamera]);

  const onPickPhoto = useCallback(() => {
    if (uploading) return;
    fileInputRef.current?.click();
  }, [uploading]);

  const onUploadFile = useCallback(
    async (file: File) => {
      if (uploading) return;

      const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
      if (!allowed.includes(file.type)) {
        setLastFailReason("Formato non supportato. Usa JPG/PNG/WEBP.");
        setRitual("error");
        return;
      }
      if (file.size > 6 * 1024 * 1024) {
        setLastFailReason("Immagine troppo grande. Max 6MB.");
        setRitual("error");
        return;
      }

      // tracking
      trackTT("UploadPhoto", { source: "gallery" });
      trackEvent("UploadPhoto", { source: "gallery" }, "/scan");

      setLastFailReason(null);
      setUploading(true);
      setRitual("loading");
      stopCamera();
      setScanFull(false);

      if (fileInputRef.current) fileInputRef.current.disabled = true;

      try {
        // compress for stability
        let workingFile = file;
        try {
          const compressedBlob = await compressImageToWebP(file, { maxSide: 1600, quality: 0.84 });
          if (compressedBlob.size > 0 && compressedBlob.size < file.size) {
            workingFile = new File([compressedBlob], "unyform.webp", { type: "image/webp" });
          }
        } catch {
          // keep original
          workingFile = file;
        }

        const c = canvasRef.current;
        if (!c) throw new Error("Canvas ref missing");

        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("Canvas non disponibile");

        // decode robust
        let bmp: ImageBitmap | null = null;
        try {
          bmp = await createImageBitmap(workingFile, { imageOrientation: "from-image" } as any);
        } catch {
          bmp = null;
        }

        if (!bmp) {
          const url = URL.createObjectURL(workingFile);
          try {
            const img = new Image();
            img.src = url;
            await img.decode().catch(() => {});
            const maxSide = 1600;
            const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
            c.width = Math.round(img.naturalWidth * scale);
            c.height = Math.round(img.naturalHeight * scale);
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, c.width, c.height);
            ctx.drawImage(img, 0, 0, c.width, c.height);
          } finally {
            URL.revokeObjectURL(url);
          }
        } else {
          const maxSide = 1600;
          const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
          c.width = Math.round(bmp.width * scale);
          c.height = Math.round(bmp.height * scale);
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, c.width, c.height);
          ctx.drawImage(bmp, 0, 0, c.width, c.height);
        }

        if (c.width < 64 || c.height < 64) throw new Error("Canvas troppo piccolo");

        // 1) landmarks
        const landmarks = await detectFaceOnImage(c);
        if (!landmarks?.length) {
          setLastFailReason("Non vedo un volto nella foto. Usa una foto frontale (niente filtri, luce naturale).");
          setRitual("error");
          return;
        }

        // upload: niente mirror. (il tuo engine dovrebbe già gestire orientamento via decode)
        const plausL = isLandmarksPlausible(landmarks, c.width, c.height, false);
        if (!plausL.ok) {
          setLastFailReason("Volto non riconosciuto. Prova: viso frontale, più vicino, luce naturale.");
          setRitual("error");
          return;
        }

        const faceBox = computeFaceBoxFromLandmarks(landmarks, c.width, c.height, false);
        const plaus = isFacePlausible(faceBox, c.width, c.height);
        if (!plaus.ok) {
          setLastFailReason("La foto non sembra un volto valido (troppo lontano / tagliato / non frontale).");
          setRitual("error");
          return;
        }

        // 2) quality gate
        const qBase = computeQuality(ctx, faceBox);
        const sharp = computeSharpness(ctx, faceBox);
        const sharpScore = clamp(sharp / 220, 0, 1);
        const combined = clamp(0.62 * qBase.score + 0.38 * sharpScore, 0, 1);

        setQuality(combined);
        setQualityHint(qBase.hint);

        if (combined < 0.5) {
          setLastFailReason("Foto troppo scura o poco nitida. Prova luce naturale e senza filtri.");
          setRitual("error");
          return;
        }

        // 3) segmentation (best effort)
        let mask: any = null;
        try {
          mask = await segmentPersonOnImage(c);
        } catch {
          mask = null;
        }

        // 4) multi-sample regional extraction (premium)
        const hexes: string[] = [];
        const regions = ["forehead", "leftCheek", "rightCheek"] as const;

        // with mask (if any)
        for (let i = 0; i < 10; i++) {
          for (const region of regions) {
            const r = extractSkinHexForRegions({
              ctx,
              canvasW: c.width,
              canvasH: c.height,
              landmarks,
              mirrorX: false,
              mask: mask ?? null,
              applyWhiteBalance: true,
              regions: [region as any],
            });
            if (r.ok) hexes.push(r.hex);
          }
        }

        // fallback base if still low
        if (hexes.length < 10) {
          for (let i = 0; i < 6; i++) {
            const base = extractSkinBaseHex({
              ctx,
              canvasW: c.width,
              canvasH: c.height,
              landmarks,
              mirrorX: false,
              mask: mask ?? null,
            });
            if (base.ok) hexes.push(base.hex);
          }
        }

        if (hexes.length < 10) {
          setLastFailReason("Non riesco a leggere bene la pelle. Viso frontale, senza filtri, più vicino.");
          setRitual("error");
          return;
        }

        const stableHex = pickStableHex(hexes);
        if (!stableHex || stableHex === "#777777") {
          setLastFailReason("Non riesco a determinare un colore stabile. Prova luce naturale e foto più ravvicinata.");
          setRitual("error");
          return;
        }

        const pal = makePaletteFromSamples(stableHex);

        const signals = getSkinSignalsFromHex(stableHex);
        const conf = computeConfidenceFromHexes({ stableHex, hexes, quality01: combined });

        const meta: ScanMeta = {
          method: "upload",
          confidence: conf.confidence,
          undertone: signals.undertone,
          depth: signals.depth,
          lab: signals.lab,
          sampleCount: hexes.length,
          quality: Math.round(combined * 100),
        };

        saveLastPalette(pal, meta, stableHex, hexes.slice(-24));

        // TikTok Pixel
        trackTT("ScanCompleted", {
          method: meta.method,
          confidence: meta.confidence,
          quality: meta.quality,
          undertone: meta.undertone,
          depth: meta.depth,
          samples: meta.sampleCount,
        });

        // internal telemetry
        trackEvent(
          "ScanCompleted",
          {
            method: meta.method,
            confidence: meta.confidence,
            quality: meta.quality,
            undertone: meta.undertone,
            depth: meta.depth,
            samples: meta.sampleCount,
          },
          "/scan"
        );

        setScanFull(false);
        setRitual("idle");
        router.push(`/result?ts=${Date.now()}`);
      } catch (e: any) {
        console.error("UPLOAD ERROR:", e);
        setLastFailReason("Errore nel caricamento foto. Riprova.");
        setRitual("error");
      } finally {
        setUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
          fileInputRef.current.disabled = false;
        }
      }
    },
    [router, stopCamera, uploading]
  );

  // auto-open upload if /scan?upload=1
  useEffect(() => {
    const up = params.get("upload");
    if (up === "1") setTimeout(() => fileInputRef.current?.click(), 200);
  }, [params]);

  const percent = Math.round(quality * 100);

  return (
    <div className="min-h-dvh bg-black text-white">
      {/* Hidden upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          onUploadFile(file);
        }}
      />

      {/* Content */}
      <main className="mx-auto max-w-6xl px-5 pb-28 pt-10">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
          {/* LEFT */}
          <section className="space-y-6">
            <div className="space-y-3">
              <h1 className="text-balance text-4xl sm:text-5xl font-semibold tracking-tight">
                Un secondo di calma.
                <br />
                Poi scegli i colori giusti per te.
              </h1>

              <p className="max-w-xl text-pretty text-[15px] leading-7 text-white/70">
                Analisi discreta sul volto. Nessuna immagine salvata.
                <br />
                Quando la qualità è buona, creiamo la palette e ti portiamo al risultato.
              </p>
            </div>

            <div className="scanSteps">
              <div className="scanStep">
                <div className="scanStepDot" />
                <div className="scanStepText">
                  <span className="scanStepStrong">Luce naturale</span> (evita controluce)
                </div>
              </div>
              <div className="scanStep">
                <div className="scanStepDot" />
                <div className="scanStepText">
                  <span className="scanStepStrong">Volto al centro</span> del cerchio
                </div>
              </div>
              <div className="scanStep">
                <div className="scanStepDot" />
                <div className="scanStepText">
                  <span className="scanStepStrong">Fermo 1 secondo</span> (automatico)
                </div>
              </div>
            </div>

            {!!lastFailReason && (
              <div className="card errorCard">
                <div className="cardTitle">Non ancora.</div>
                <div className="cardText">{lastFailReason}</div>
              </div>
            )}

            {uploading && (
              <div className="card subtleCard">
                <div className="cardText">Analisi foto in corso…</div>
              </div>
            )}

            <div className="scanTrust">
              <div className="scanTrustTitle">Privacy by design</div>
              <div className="scanTrustText">Il calcolo avviene sul tuo dispositivo. Nessun upload automatico.</div>
            </div>

            {debug && (
              <div className="card subtleCard">
                <div className="cardText">
                  <div className="text-white/80 text-[12px]">DEBUG</div>
                  <div className="text-white/60 text-[12px] mt-1">
                    samples: {stableHexesRef.current.length} · goodFrames: {goodFramesRef.current}
                  </div>
                  <div className="text-white/60 text-[12px] mt-1 font-mono break-all">
                    last: {stableHexesRef.current.slice(-8).join(" · ")}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* RIGHT */}
          <section
            className={[
              "space-y-4",
              scanFull ? "fixed inset-0 z-50 bg-black p-5 pt-6 overflow-auto lg:static lg:z-auto lg:p-0" : "",
            ].join(" ")}
          >
            {scanFull && (
              <div className="flex items-center justify-between pb-3 lg:hidden">
                <div className="text-[12px] tracking-[0.22em] text-white/65">{BRAND}</div>
                <button
                  onClick={() => {
                    setScanFull(false);
                    stopCamera();
                    setRitual("idle");
                    setQuality(0);
                    setQualityHint("Analisi discreta. Nessuna foto salvata.");
                    stableHexesRef.current = [];
                    goodFramesRef.current = 0;
                  }}
                  className="pillButton subtle"
                >
                  Chiudi
                </button>
              </div>
            )}

            {/* 👇 ANCHOR */}
            <div ref={scanAnchorRef} id="scan" className="scroll-mt-24" />

            <div className="scanShell">
              <div className="scanAurora" aria-hidden />
              <div className="scanNoise" aria-hidden />

              <div className="scanFrame">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className={["scanVideo", ritual === "calibrating" || ritual === "loading" ? "on" : "off"].join(" ")}
                />

                <div className="scanVignette" aria-hidden />

                <div className="scanOverlay">
                  <div className="scanTopRow">
                    <div className="scanChip">
                      {ritual === "loading" ? "Avvio…" : ritual === "calibrating" ? "Calibrazione" : "Pronto"}
                    </div>
                    <div className="scanChip subtle">
                      Qualità <span className="tabular-nums">{percent}%</span>
                    </div>
                  </div>

                  <div className={["scanRing", ritual === "calibrating" ? "pulse" : ""].join(" ")} />

                  <div className="scanBottom">
                    <div className="scanHint">{qualityHint}</div>

                    <div className="scanBar">
                      <div className="scanFill" style={{ width: `${percent}%` }} />
                      <div className="scanTarget" style={{ left: `${Math.round(THRESHOLD * 100)}%` }} />
                    </div>

                    <div className="scanMeta">
                      <span className="scanMetaItem">Target: {Math.round(THRESHOLD * 100)}%</span>
                      <span className="scanMetaSep">•</span>
                      <span className="scanMetaItem">Face engine: ON</span>
                    </div>
                  </div>
                </div>

                <canvas ref={canvasRef} className="hidden" />
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Sticky bottom */}
<div className="fixed bottom-0 left-0 right-0 z-[90] px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4 bg-gradient-to-t from-black/90 to-transparent">
  <div className="mx-auto flex max-w-md flex-col gap-3">
          <button
            onClick={startRitual}
            className="h-14 w-full rounded-2xl bg-white text-black text-[15px] font-medium tracking-wide hover:bg-white/90 transition active:scale-[0.99]"
          >
            Avvia calibrazione
          </button>

          <button
            onClick={onPickPhoto}
            className="h-12 w-full rounded-2xl border border-white/20 text-[14px] tracking-wide text-white/85 hover:bg-white/[0.06] transition active:scale-[0.99]"
          >
            Carica una foto
          </button>
        </div>
      </div>
    </div>
  );
}
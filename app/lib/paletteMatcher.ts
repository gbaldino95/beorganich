// app/lib/paletteMatcher.ts
import { hexToLab, deltaE } from "@/app/lib/colorMath";
import { BRAND_COLORS, type BrandStyle } from "@/app/lib/paletteLibrary";

export type PaletteItem = {
  id: number;
  name: string;
  hex: string;
  style: BrandStyle;
};

export type Sample = {
  hex: string;
  /** es: "cheekL", "cheekR", "forehead", "jaw", "nose" */
  region?: string;
  /** default 1 */
  weight?: number;
};

export type MatchResult = {
  style: BrandStyle;
  colors: PaletteItem[]; // topN (diversificati)
  debug?: {
    samplesUsed: Array<{ hex: string; region?: string; weight: number }>;
    samplesRejected: Array<{ hex: string; region?: string; reason: string }>;
    quality: {
      countIn: number;
      countOut: number;
      spread: number; // variabilità campioni
      isWeak: boolean;
    };
    rankedTop10: Array<{ id: number; name: string; hex: string; style: BrandStyle; loss: number }>;
    stylePosterior: Record<BrandStyle, number>;
    styleAvgLoss: Record<BrandStyle, number>;
    confidence: number; // 0..1
  };
};

const STYLES: BrandStyle[] = ["NOIR ICON", "SAND LUXE", "SAGE MODERN", "ICE ROYAL"];

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function avg(nums: number[]) {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : Number.POSITIVE_INFINITY;
}

function median(nums: number[]) {
  if (!nums.length) return Number.POSITIVE_INFINITY;
  const a = [...nums].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function softmax(vals: number[], temperature = 1) {
  const t = Math.max(1e-6, temperature);
  const mx = Math.max(...vals);
  const exps = vals.map((v) => Math.exp((v - mx) / t));
  const s = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((e) => e / s);
}

function emptyStyleMap(): Record<BrandStyle, number> {
  return {
    "NOIR ICON": 0,
    "SAND LUXE": 0,
    "SAGE MODERN": 0,
    "ICE ROYAL": 0,
  };
}

/** Validazione hex semplice */
function isHex(h: string) {
  const x = (h || "").trim();
  return /^#?[0-9A-Fa-f]{6}$/.test(x) || /^#?[0-9A-Fa-f]{3}$/.test(x);
}
function normHex(h: string) {
  let x = (h || "").trim();
  if (!x.startsWith("#")) x = `#${x}`;
  if (x.length === 4) {
    // #abc -> #aabbcc
    const r = x[1], g = x[2], b = x[3];
    x = `#${r}${r}${g}${g}${b}${b}`;
  }
  return x.toUpperCase();
}

/** pesi regione: cheek > jaw > forehead > nose */
function regionWeight(region?: string) {
  const r = (region || "").toLowerCase();
  if (r.includes("cheek")) return 1.25;
  if (r.includes("jaw")) return 1.1;
  if (r.includes("forehead")) return 0.9;
  if (r.includes("nose")) return 0.8;
  return 1.0;
}

/** distanza media tra campioni (qualità) */
function samplesSpread(sampleLabs: any[]) {
  if (sampleLabs.length < 2) return 0;
  const ds: number[] = [];
  for (let i = 0; i < sampleLabs.length; i++) {
    for (let j = i + 1; j < sampleLabs.length; j++) ds.push(deltaE(sampleLabs[i], sampleLabs[j]));
  }
  return avg(ds);
}

/**
 * Outlier rejection:
 * - calcola per ogni campione la distanza dalla mediana del gruppo
 * - scarta quelli troppo lontani (ombra, highlight, rumore)
 */
function rejectOutliers(samples: Array<{ hex: string; lab: any; w: number; region?: string }>) {
  if (samples.length <= 3) return { kept: samples, rejected: [] as any[] };

  // distanza di ciascun sample dal “centro” (mediana del gruppo)
  // centro: scegliamo il sample che minimizza la somma delle distanze (medoid)
  const sumDist = samples.map((s, i) => {
    let sum = 0;
    for (let j = 0; j < samples.length; j++) {
      if (i === j) continue;
      sum += deltaE(s.lab, samples[j].lab);
    }
    return sum;
  });
  const medoidIdx = sumDist.indexOf(Math.min(...sumDist));
  const center = samples[medoidIdx].lab;

  const ds = samples.map((s) => deltaE(s.lab, center));
  const dMed = median(ds);
  const dMad = median(ds.map((d) => Math.abs(d - dMed))) || 0.0001;

  // soglia robusta: mediana + k * MAD
  const k = 3.0;
  const thr = dMed + k * dMad;

  const kept: typeof samples = [];
  const rejected: any[] = [];
  samples.forEach((s, idx) => {
    const d = ds[idx];
    if (d <= thr) kept.push(s);
    else rejected.push({ hex: s.hex, region: s.region, reason: `outlier d=${d.toFixed(2)} thr=${thr.toFixed(2)}` });
  });

  // safety: non scartare troppo
  if (kept.length < 2) return { kept: samples, rejected: [] as any[] };
  return { kept, rejected };
}

/**
 * Loss robusta (industrial):
 * Per ogni campione: DeltaE
 * - weighted mean “trimmed” (taglia peggiori 25%)
 * - + mediana per stabilità
 * - + min per compatibilità reale
 */
function robustLossToSamples(colorHex: string, samples: Array<{ lab: any; w: number }>) {
  const lab = hexToLab(colorHex);
  const ds = samples.map((s) => ({ d: deltaE(lab, s.lab), w: s.w }))
    .sort((a, b) => a.d - b.d);

  const dMin = ds[0]?.d ?? 999;

  const dVals = ds.map((x) => x.d);
  const dMed = median(dVals);

  // trimmed: taglia peggiori 25%
  const cut = ds.length > 3 ? Math.floor(ds.length * 0.25) : 0;
  const kept = ds.slice(0, ds.length - cut);

  const wSum = kept.reduce((a, b) => a + b.w, 0) || 1;
  const wMean = kept.reduce((a, b) => a + b.d * b.w, 0) / wSum;

  // Mix: min (compatibilità), med (stabilità), mean (generale)
  // Tuning “commerciale”: il match deve essere coerente ma non iper-sensibile
  return 0.45 * dMin + 0.30 * dMed + 0.25 * wMean;
}

/** diversifica: evita 5 colori troppo simili */
function diversifyByDistance(sorted: Array<{ hex: string; loss: number }>, minDelta = 4.0, take = 5) {
  const picked: typeof sorted = [];
  for (const c of sorted) {
    if (picked.length >= take) break;
    const ok = picked.every((p) => deltaE(hexToLab(p.hex), hexToLab(c.hex)) >= minDelta);
    if (ok) picked.push(c);
  }
  // se non basta, completa comunque
  for (const c of sorted) {
    if (picked.length >= take) break;
    if (!picked.includes(c)) picked.push(c);
  }
  return picked.slice(0, take);
}

/**
 * ✅ ULTRA MATCHER
 * Usa samples (meglio) oppure fallback baseHex.
 */
export function matchPaletteUltra(input: { baseHex?: string; samples?: Sample[] }, topN = 5): MatchResult {
  const rawSamples: Sample[] =
    input.samples?.length
      ? input.samples
      : input.baseHex
        ? [{ hex: input.baseHex, region: "base", weight: 1 }]
        : [];

  const rejectedInvalid: Array<{ hex: string; region?: string; reason: string }> = [];
  const prepared = rawSamples
    .map((s) => ({
      hex: s?.hex ?? "",
      region: s?.region,
      w: (s?.weight ?? 1) * regionWeight(s?.region),
    }))
    .filter((s) => {
      if (!isHex(s.hex)) {
        rejectedInvalid.push({ hex: s.hex, region: s.region, reason: "invalid_hex" });
        return false;
      }
      return true;
    })
    .slice(0, 16)
    .map((s) => {
      const hex = normHex(s.hex);
      return { hex, region: s.region, w: clamp(s.w, 0.2, 2.0), lab: hexToLab(hex) };
    });

  // fallback “safe” (neutro) se pochi campioni validi
  const fallback = [
    { hex: "#CBB2A3", region: "fallback", w: 1, lab: hexToLab("#CBB2A3") },
    { hex: "#E7DFD5", region: "fallback", w: 0.9, lab: hexToLab("#E7DFD5") },
  ];
  const baseSamples = prepared.length ? prepared : fallback;

  // outlier rejection
  const { kept, rejected } = rejectOutliers(baseSamples);

  const spread = samplesSpread(kept.map((s) => s.lab));
  const isWeak = kept.length < 3 || spread < 3.25; // troppo “piatti” => input povero

  // ranking su tutta la libreria
  const ranked = BRAND_COLORS
    .map((c) => {
      const loss = robustLossToSamples(c.hex, kept);
      return { ...c, loss };
    })
    .sort((a, b) => a.loss - b.loss);

  // top candidati (prima “grezza”)
  const topRaw = ranked.slice(0, Math.max(12, topN * 3));

  // diversificazione palette
  const diversified = diversifyByDistance(
    topRaw.map((x) => ({ hex: x.hex.toUpperCase(), loss: x.loss })),
    4.2,
    topN
  );

  // ricostruisci items da diversified
  const colors: PaletteItem[] = diversified.map((d) => {
    const src = ranked.find((r) => r.hex.toUpperCase() === d.hex)!;
    return { id: src.id, name: src.name, hex: d.hex, style: src.style };
  });

  // style: posterior probabilistico su topRaw (non solo majority)
  const styleAvgLoss = emptyStyleMap();
  for (const s of STYLES) {
    const ds = topRaw.filter((x) => x.style === s).map((x) => x.loss);
    styleAvgLoss[s] = ds.length ? avg(ds) : 999;
  }

  // softmax su -loss (min loss => prob alta)
  const vals = STYLES.map((s) => -styleAvgLoss[s]);
  const probs = softmax(vals, 0.65); // temp < 1 => più deciso
  const stylePosterior = emptyStyleMap();
  STYLES.forEach((s, i) => (stylePosterior[s] = Math.round(probs[i] * 1000) / 1000));

  // best style
  let bestStyle: BrandStyle = "SAND LUXE";
  for (const s of STYLES) {
    if (stylePosterior[s] > stylePosterior[bestStyle]) bestStyle = s;
  }

  // confidence: gap posterior + qualità campioni
  const sortedP = [...STYLES].sort((a, b) => stylePosterior[b] - stylePosterior[a]);
  const p1 = stylePosterior[sortedP[0]];
  const p2 = stylePosterior[sortedP[1]] ?? 0;
  const gap = clamp((p1 - p2) / 0.35, 0, 1);
  const q = isWeak ? 0.55 : 1.0;
  const confidence = clamp(0.75 * gap + 0.25 * q, 0, 1);

  return {
    style: bestStyle,
    colors,
    debug: {
      samplesUsed: kept.map((s) => ({ hex: s.hex, region: s.region, weight: Math.round(s.w * 100) / 100 })),
      samplesRejected: [...rejectedInvalid, ...rejected],
      quality: {
        countIn: kept.length,
        countOut: rejectedInvalid.length + rejected.length,
        spread: Math.round(spread * 100) / 100,
        isWeak,
      },
      rankedTop10: ranked.slice(0, 10).map((c) => ({
        id: c.id,
        name: c.name,
        hex: c.hex.toUpperCase(),
        style: c.style,
        loss: Math.round(c.loss * 100) / 100,
      })),
      stylePosterior,
      styleAvgLoss: {
        "NOIR ICON": Math.round(styleAvgLoss["NOIR ICON"] * 100) / 100,
        "SAND LUXE": Math.round(styleAvgLoss["SAND LUXE"] * 100) / 100,
        "SAGE MODERN": Math.round(styleAvgLoss["SAGE MODERN"] * 100) / 100,
        "ICE ROYAL": Math.round(styleAvgLoss["ICE ROYAL"] * 100) / 100,
      },
      confidence: Math.round(confidence * 100) / 100,
    },
  };
}

/** compat: vecchia firma */
export function matchPalette(baseHex: string, topN = 5): MatchResult {
  return matchPaletteUltra({ baseHex }, topN);
}

/** helper: se hai già array di hex */
export function matchPaletteFromSamples(samplesHex: string[], topN = 5): MatchResult {
  const samples: Sample[] = (samplesHex || []).map((hex) => ({ hex, region: "sample", weight: 1 }));
  return matchPaletteUltra({ samples }, topN);
}
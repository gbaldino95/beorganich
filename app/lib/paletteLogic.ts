// app/lib/paletteLogic.ts
import { BRAND_COLORS, type BrandStyle } from "@/app/lib/paletteLibrary";
import { hexToLab, deltaE, normalizeHex } from "@/app/lib/colorMath";

/** UI item palette */
export type PaletteItem = {
  name: string;
  hex: string;
  id?: number;
  style?: BrandStyle;
};

/** Copy premium */
export type StyleInsight = {
  style: BrandStyle;
  displayName: string;
  title: string;
  subtitle: string;
  hook: string;
  cta: string;
};

const STYLE_COPY: Record<BrandStyle, StyleInsight> = {
  "NOIR ICON": {
    style: "NOIR ICON",
    displayName: "ICON NOIR",
    title: "Il tuo look diventa più pulito, più forte, più expensive.",
    subtitle:
      "Questi colori aumentano contrasto e definizione sul viso. Zero caos: solo capi che funzionano davvero su di te.",
    hook: "Se in foto ti sembri “spento”, questo è il fix.",
    cta: "Vedi i capi ICON NOIR →",
  },
  "SAND LUXE": {
    style: "SAND LUXE",
    displayName: "SAND LUXE",
    title: "Effetto pelle sana. Look caldo premium.",
    subtitle:
      "Toni che armonizzano il viso e rendono tutto più naturale. Risultato: più luce, meno indecisioni.",
    hook: "Questo è il set che ti fa dire “ok wow” allo specchio.",
    cta: "Vedi i capi SAND LUXE →",
  },
  "SAGE MODERN": {
    style: "SAGE MODERN",
    displayName: "SAGE STUDIO",
    title: "Minimal moderno. Sempre curato, sempre coerente.",
    subtitle:
      "Colori che puliscono la palette e ti danno subito un’aria ordinata. Il tuo “uniform” di stile.",
    hook: "Outfit senza sbatti. Ma di livello.",
    cta: "Vedi i capi SAGE STUDIO →",
  },
  "ICE ROYAL": {
    style: "ICE ROYAL",
    displayName: "ICE ROYAL",
    title: "Più luminosità. Più definizione. Più presenza.",
    subtitle:
      "Toni freddi che rendono il viso più nitido e lo sguardo più chiaro. Clean, sharp, high-end.",
    hook: "Se ami l’effetto “clean & sharp”, sei nel posto giusto.",
    cta: "Vedi i capi ICE ROYAL →",
  },
};

export function getStyleInsight(style: BrandStyle): StyleInsight {
  return STYLE_COPY[style] ?? STYLE_COPY["SAND LUXE"];
}

/* --------------------- helpers --------------------- */

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function clamp01(x: number) {
  return clamp(x, 0, 1);
}

// hexToLab può essere array o object: normalizziamo accesso
function getL(lab: any) {
  return Array.isArray(lab) ? lab[0] : lab?.L ?? lab?.l ?? 0;
}
function getA(lab: any) {
  return Array.isArray(lab) ? lab[1] : lab?.a ?? 0;
}
function getB(lab: any) {
  return Array.isArray(lab) ? lab[2] : lab?.b ?? 0;
}

type SkinSignals = {
  undertone: "warm" | "cool" | "neutral";
  depth: "light" | "medium" | "deep";
  lab: { L: number; a: number; b: number };
};

function skinSignalsFromLab(skinLab: any): SkinSignals {
  const L = getL(skinLab);
  const a = getA(skinLab);
  const b = getB(skinLab);

  const undertone: SkinSignals["undertone"] = b >= 9 ? "warm" : b <= -6 ? "cool" : "neutral";
  const depth: SkinSignals["depth"] = L >= 72 ? "light" : L <= 46 ? "deep" : "medium";

  return {
    undertone,
    depth,
    lab: { L: Math.round(L), a: Math.round(a), b: Math.round(b) },
  };
}

function roleRanges(depth: SkinSignals["depth"]) {
  // range “wearable” per evitare scelte estreme o tutte simili
  // (sono range di L* in CIELAB)
  if (depth === "light") {
    return {
      darkMax: 30,
      midMin: 30,
      midMax: 60,
      lightMin: 60,
      lightMax: 88,
    };
  }
  if (depth === "deep") {
    return {
      darkMax: 28,
      midMin: 28,
      midMax: 62,
      lightMin: 62,
      lightMax: 92,
    };
  }
  // medium
  return {
    darkMax: 28,
    midMin: 28,
    midMax: 58,
    lightMin: 58,
    lightMax: 90,
  };
}

function contrastTargets(depth: SkinSignals["depth"]) {
  // contrasto “fashion realistico” (non teorico)
  // troppo poco = washout, troppo = harsh
  if (depth === "light") return { min: 22, max: 62 };
  if (depth === "deep") return { min: 20, max: 70 };
  return { min: 18, max: 55 };
}

function undertoneAffinity(undertone: SkinSignals["undertone"], bColor: number) {
  // b* > 0 tende warm; b* < 0 tende cool
  if (undertone === "warm") {
    // premiamo caldo, ma non “arancione violento”
    if (bColor >= 10) return 1.0;
    if (bColor >= 4) return 0.75;
    if (bColor >= 0) return 0.35;
    return 0.0;
  }
  if (undertone === "cool") {
    if (bColor <= -4) return 1.0;
    if (bColor <= 0) return 0.75;
    if (bColor <= 4) return 0.35;
    return 0.0;
  }
  // neutral
  const abs = Math.abs(bColor);
  if (abs <= 4) return 1.0;
  if (abs <= 8) return 0.65;
  if (abs <= 12) return 0.35;
  return 0.1;
}

function softnessGate(aColor: number, bColor: number) {
  // penalizza colori “troppo saturi” (a*/b* enormi) che su pelle reale spesso “urlano”
  // non è censura: è solo un gate morbido.
  const chroma = Math.hypot(aColor, bColor);
  // 0..1 (1 = ottimo, 0 = troppo saturo)
  return clamp01(1 - (chroma - 22) / 26);
}

function pairwiseMinDistanceOk(candidateHex: string, pickedHexes: string[], minDE: number) {
  if (!pickedHexes.length) return true;
  try {
    const cLab = hexToLab(candidateHex);
    for (const ph of pickedHexes) {
      const d = deltaE(cLab as any, hexToLab(ph) as any);
      if (d < minDE) return false;
    }
    return true;
  } catch {
    return true;
  }
}

type Scored = (typeof BRAND_COLORS)[number] & {
  lab: any;
  dE_skin: number;
  L: number;
  a: number;
  b: number;
  contrast: number;
  total: number;
  // breakdown utile se un giorno vuoi debug
  _parts: {
    closeness: number;
    contrast: number;
    undertone: number;
    washout: number;
    depth: number;
    softness: number;
  };
};

/**
 * ULTRA:
 * - score = closeness (DeltaE) + contrast wearable + undertone affinity + anti-washout + depth + softness gate
 * - selezione per ruoli (dark/mid/light/accent/accent2) con vincolo di distanza minima tra colori
 * - stile dedotto con voto pesato dai punteggi (non solo count)
 */
export function makePaletteFromSamples(baseHex: string): PaletteItem[] {
  const skinHex = normalizeHex(baseHex);
  const skinLab = hexToLab(skinHex);
  const sig = skinSignalsFromLab(skinLab);

  const { min: contrastMin, max: contrastMax } = contrastTargets(sig.depth);
  const ranges = roleRanges(sig.depth);

  // distanza minima tra colori scelti per evitare “quasi uguali”
  const minPairDE = sig.depth === "light" ? 8.5 : sig.depth === "deep" ? 9.0 : 8.8;

  function scoreColor(c: (typeof BRAND_COLORS)[number]): Scored {
    const lab = hexToLab(c.hex);
    const dE = deltaE(skinLab as any, lab as any);

    const Lc = getL(lab);
    const ac = getA(lab);
    const bc = getB(lab);

    const contrast = Math.abs(Lc - getL(skinLab));

    // closeness: se troppo vicino alla pelle NON va bene come capo (washout)
    // quindi closeness ha “sweet spot”: non vogliamo 0, vogliamo “vicino ma non nude”
    // targetDE ~ 16..34 (dipende)
    const sweetCenter = sig.depth === "light" ? 26 : sig.depth === "deep" ? 28 : 27;
    const sweetWidth = 16; // più largo = più permissivo
    const closeness01 = clamp01(1 - Math.abs(dE - sweetCenter) / sweetWidth);
    const closeness = 46 * Math.pow(closeness01, 1.15);

    // contrast wearable
    const contrast01 =
      contrast < contrastMin
        ? clamp01(contrast / contrastMin)
        : contrast > contrastMax
        ? clamp01(1 - (contrast - contrastMax) / 30)
        : 1;

    const contrastPart = 22 * Math.pow(contrast01, 1.25);

    // undertone
    const undertone01 = undertoneAffinity(sig.undertone, bc);
    const undertonePart = 18 * Math.pow(undertone01, 1.1);

    // anti-washout: se dE troppo basso penalizziamo forte
    const washoutPenalty =
      dE < 8 ? -34 : dE < 11 ? -22 : dE < 14 ? -10 : 0;

    // depth guard (evita scelte che “spariscono”)
    let depthPart = 0;
    if (sig.depth === "light") {
      // su pelle chiara: evita neri “piatti” troppo low-L e evita beige troppo simili
      if (Lc <= 10) depthPart -= 14;
      if (dE < 12) depthPart -= 10;
      if (Lc >= 18) depthPart += 5;
    } else if (sig.depth === "deep") {
      // su pelle scura: premi contrasti veri e evita colori troppo chiari “gessosi”
      if (Lc >= 90) depthPart -= 10;
      if (contrast >= 24) depthPart += 6;
    } else {
      // medium: equilibrio
      if (contrast >= 20 && contrast <= 55) depthPart += 5;
    }

    // softness gate (anti neon)
    const soft01 = softnessGate(ac, bc);
    const softnessPart = 10 * soft01;

    const total = closeness + contrastPart + undertonePart + depthPart + softnessPart + washoutPenalty;

    return {
      ...(c as any),
      lab,
      dE_skin: dE,
      L: Lc,
      a: ac,
      b: bc,
      contrast,
      total,
      _parts: {
        closeness,
        contrast: contrastPart,
        undertone: undertonePart,
        washout: washoutPenalty,
        depth: depthPart,
        softness: softnessPart,
      },
    };
  }

  const scored = BRAND_COLORS.map(scoreColor).sort((x, y) => y.total - x.total);

  // --- helper pick: prende il primo che rispetta ruolo + diversità ---
  const picked: Scored[] = [];
  const pickedHexes: string[] = [];

  function pickWhere(filter: (c: Scored) => boolean, opts?: { relaxMinDE?: boolean }) {
    const minDE = opts?.relaxMinDE ? Math.max(6.8, minPairDE - 2.0) : minPairDE;

    const found = scored.find((c) => {
      if (!filter(c)) return false;
      if (picked.some((p) => p.id === c.id)) return false;
      if (!pairwiseMinDistanceOk(c.hex, pickedHexes, minDE)) return false;
      return true;
    });

    if (found) {
      picked.push(found);
      pickedHexes.push(found.hex);
      return true;
    }
    return false;
  }

  // RUOLI: Dark / Mid / Light / Accent / Accent2
  // Dark anchor
  pickWhere((c) => c.L <= ranges.darkMax);

  // Mid core
  pickWhere((c) => c.L >= ranges.midMin && c.L <= ranges.midMax);

  // Light lift
  pickWhere((c) => c.L >= ranges.lightMin && c.L <= ranges.lightMax);

  // Accent (undertone-driven + un po’ più “carattere”)
  pickWhere((c) => {
    const ut = undertoneAffinity(sig.undertone, c.b);
    const soft = softnessGate(c.a, c.b);
    // vogliamo un accent che “si sente” ma non neon
    return ut >= 0.65 && soft >= 0.45 && c.dE_skin >= 14;
  });

  // Accent2: prova a cambiare style rispetto al primo, mantenendo qualità
  pickWhere(
    (c) => {
      const firstStyle = picked[0]?.style;
      const ut = undertoneAffinity(sig.undertone, c.b);
      return (!!firstStyle ? c.style !== firstStyle : true) && ut >= 0.35 && c.dE_skin >= 13;
    },
    { relaxMinDE: true }
  );

  // Fill se manca qualcosa
  while (picked.length < 5) {
    const ok = pickWhere(
      (c) => c.total >= scored[Math.min(40, scored.length - 1)]?.total, // stai nella “zona buona”
      { relaxMinDE: true }
    );
    if (!ok) {
      // ultima spiaggia: prendi il best non duplicato
      const next = scored.find((c) => !picked.some((p) => p.id === c.id));
      if (!next) break;
      picked.push(next);
      pickedHexes.push(next.hex);
    }
  }

  // --- Stile: voto pesato (non solo count) + tie-break su distanza media ---
  const styles: BrandStyle[] = ["NOIR ICON", "SAND LUXE", "SAGE MODERN", "ICE ROYAL"];
  const weightByStyle: Record<BrandStyle, number> = {
    "NOIR ICON": 0,
    "SAND LUXE": 0,
    "SAGE MODERN": 0,
    "ICE ROYAL": 0,
  };

  const avgDistByStyle: Record<BrandStyle, number> = {
    "NOIR ICON": 999,
    "SAND LUXE": 999,
    "SAGE MODERN": 999,
    "ICE ROYAL": 999,
  };

  for (const s of styles) {
    const items = picked.filter((p) => p.style === s);
    if (!items.length) continue;

    // peso: più total alto => più conta
    weightByStyle[s] = items.reduce((acc, x) => acc + clamp(x.total, 0, 120), 0);

    // tie-break: più vicino alla pelle (ma non washout) come “armonia”
    const ds = items.map((x) => x.dE_skin);
    avgDistByStyle[s] = ds.reduce((a, b) => a + b, 0) / ds.length;
  }

  let bestStyle: BrandStyle = "SAND LUXE";
  for (const s of styles) {
    const betterWeight = weightByStyle[s] > weightByStyle[bestStyle] + 0.0001;
    const tieWeight = Math.abs(weightByStyle[s] - weightByStyle[bestStyle]) < 0.0001;
    const betterTie = tieWeight && avgDistByStyle[s] < avgDistByStyle[bestStyle];
    if (betterWeight || betterTie) bestStyle = s;
  }

  // Ordine finale: preferisci colori dello style dedotto + poi per qualità
  const ordered = [...picked].sort((a, b) => {
    const as = a.style === bestStyle ? 0 : 1;
    const bs = b.style === bestStyle ? 0 : 1;
    if (as !== bs) return as - bs;
    return b.total - a.total;
  });

  return ordered.slice(0, 5).map((c) => ({
    id: c.id,
    style: c.style,
    name: c.name,
    hex: c.hex.toUpperCase(),
  }));
}

/* ------------------ URL/Share helpers ------------------ */

export function buildShopifyDeepLink(shopBaseUrl: string, palette: PaletteItem[]) {
  const hexes = (palette ?? []).slice(0, 3).map((p) => p.hex.replace("#", "").toLowerCase());
  const slug = hexes.length ? `palette-${hexes.join("-")}` : "palette";
  return `${shopBaseUrl.replace(/\/$/, "")}/collections/${slug}`;
}

export function buildShareUrl(baseUrl: string, palette: PaletteItem[], brand: string) {
  const hexes = (palette ?? []).map((p) => p.hex.replace("#", "").toLowerCase()).join(",");
  const u = new URL(baseUrl);
  u.pathname = "/result";
  u.searchParams.set("brand", brand);
  if (hexes) u.searchParams.set("c", hexes);
  return u.toString();
}

export function buildShareText(palette: PaletteItem[], title: string, url: string) {
  const line = palette.map((p) => `${p.name} ${p.hex.toUpperCase()}`).join(" • ");
  return `${title}\n${line}\n${url}`;
}
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
  style: BrandStyle;     // enum interno
  displayName: string;   // nome wow UI
  title: string;         // headline result
  subtitle: string;      // sub conversion
  hook: string;          // micro-hook (wow)
  cta: string;           // label CTA shop
};

/**
 * Copy “trend TikTok ma premium”.
 * (Puoi cambiare testi quando vuoi)
 */
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

/**
 * Nuova logica “reale”:
 * - legge skin tone (Lab)
 * - stima undertone (warm/cool/neutral)
 * - stima depth (light/medium/deep)
 * - sceglie 5 colori dal catalogo BRAND con:
 *   - contrasto sensato
 *   - harmony undertone
 *   - anti “wash-out nude”
 *   - diversità (dark/mid/light/accent/accent2)
 */
export function makePaletteFromSamples(baseHex: string): PaletteItem[] {
  const skinHex = normalizeHex(baseHex);
  const skinLab = hexToLab(skinHex);

  // compat: hexToLab può essere array [L,a,b] o oggetto
  const getL = (lab: any) => (Array.isArray(lab) ? lab[0] : lab?.L ?? lab?.l ?? 0);
  const getA = (lab: any) => (Array.isArray(lab) ? lab[1] : lab?.a ?? 0);
  const getB = (lab: any) => (Array.isArray(lab) ? lab[2] : lab?.b ?? 0);

  // --- skin signals ---
  const L = getL(skinLab);
  const a = getA(skinLab);
  const b = getB(skinLab);

  const undertone: "warm" | "cool" | "neutral" =
    b >= 9 ? "warm" : b <= -6 ? "cool" : "neutral";

  const depth: "light" | "medium" | "deep" =
    L >= 72 ? "light" : L <= 46 ? "deep" : "medium";

  // --- scoring ---
  function scoreColor(c: (typeof BRAND_COLORS)[number]) {
    const lab = hexToLab(c.hex);
    const dE = deltaE(skinLab as any, lab as any);

    const Lc = getL(lab);
    const bc = getB(lab);

    const contrast = Math.abs(Lc - L);

    let contrastTargetMin = 18;
    let contrastTargetMax = 55;

    if (depth === "light") {
      contrastTargetMin = 22;
      contrastTargetMax = 62;
    } else if (depth === "deep") {
      contrastTargetMin = 20;
      contrastTargetMax = 70;
    }

    const contrastOk = contrast >= contrastTargetMin && contrast <= contrastTargetMax;
    const contrastBonus = contrastOk ? 18 : -8;

    let toneBonus = 0;
    if (undertone === "warm") toneBonus = bc >= 2 ? 14 : -10;
    if (undertone === "cool") toneBonus = bc <= 0 ? 14 : -10;
    if (undertone === "neutral") toneBonus = Math.abs(bc) <= 6 ? 10 : -4;

    // anti nude-washout: se il colore è troppo simile alla pelle penalizza
    const washoutPenalty = dE < 9 ? -22 : dE < 13 ? -10 : 0;

    let depthBonus = 0;
    if (depth === "deep") depthBonus = Lc >= 20 ? 6 : -8;
    if (depth === "light") depthBonus = Lc <= 14 ? -10 : 4;

    const closenessScore = Math.max(0, 42 - dE);

    const total =
      closenessScore +
      contrastBonus +
      toneBonus +
      washoutPenalty +
      depthBonus;

    return { ...c, dE, contrast, total };
  }

  const scored = BRAND_COLORS.map(scoreColor).sort((x, y) => y.total - x.total);

  // --- diversity pick ---
  const picked: Array<(typeof scored)[number]> = [];

  function pick(filter: (c: (typeof scored)[number]) => boolean) {
    const found = scored.find((c) => filter(c) && !picked.some((p) => p.id === c.id));
    if (found) picked.push(found);
  }

  // Dark anchor
  pick((c) => getL(hexToLab(c.hex)) <= (depth === "light" ? 28 : 24));

  // Mid core
  pick((c) => {
    const Lx = getL(hexToLab(c.hex));
    return Lx >= 28 && Lx <= 58;
  });

  // Light lift
  pick((c) => {
    const Lx = getL(hexToLab(c.hex));
    return Lx >= 58 && Lx <= 82;
  });

  // Accent by undertone
  pick((c) => {
    const lab = hexToLab(c.hex);
    const bc = getB(lab);
    if (undertone === "warm") return bc >= 8;
    if (undertone === "cool") return bc <= -2;
    return Math.abs(bc) <= 6;
  });

  // Accent 2: style diverso (se possibile)
  pick((c) => c.style !== picked[0]?.style);

  // Fill to 5
  while (picked.length < 5) {
    const next = scored.find((c) => !picked.some((p) => p.id === c.id));
    if (!next) break;
    picked.push(next);
  }

  // --- bestStyle vote ---
  const votes: Record<BrandStyle, number> = {
    "NOIR ICON": 0,
    "SAND LUXE": 0,
    "SAGE MODERN": 0,
    "ICE ROYAL": 0,
  };

  for (const c of picked) votes[c.style] += 1;

  const styles: BrandStyle[] = ["NOIR ICON", "SAND LUXE", "SAGE MODERN", "ICE ROYAL"];

  const avgDist: Record<BrandStyle, number> = {
    "NOIR ICON": 999,
    "SAND LUXE": 999,
    "SAGE MODERN": 999,
    "ICE ROYAL": 999,
  };

  for (const s of styles) {
    const ds = picked.filter((t) => t.style === s).map((t) => t.dE);
    avgDist[s] = ds.length ? ds.reduce((aa, bb) => aa + bb, 0) / ds.length : 999;
  }

  let bestStyle: BrandStyle = "SAND LUXE";
  for (const s of styles) {
    const betterVotes = votes[s] > votes[bestStyle];
    const tieVotes = votes[s] === votes[bestStyle];
    const betterTie = tieVotes && avgDist[s] < avgDist[bestStyle];
    if (betterVotes || betterTie) bestStyle = s;
  }

  // Order: bestStyle first, then by score
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

/* ------------------ Le tue funzioni restano uguali ------------------ */

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
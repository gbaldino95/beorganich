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
 * OPZIONE (2):
 * - Calcolo distanza su 48 colori
 * - Prendo top 5 assoluti
 * - Deduzione stile: majority vote + tie-break su distanza media
 *
 * Ritorna: 5 colori (con style e id inclusi) già ordinati
 */
export function makePaletteFromSamples(baseHex: string): PaletteItem[] {
  const skinHex = normalizeHex(baseHex);
  const baseLab = hexToLab(skinHex);

  const ranked = BRAND_COLORS
    .map((c) => ({
      ...c,
      distance: deltaE(baseLab, hexToLab(c.hex)),
    }))
    .sort((a, b) => a.distance - b.distance);

  const top = ranked.slice(0, 5);

  // vote per stile
  const votes: Record<BrandStyle, number> = {
    "NOIR ICON": 0,
    "SAND LUXE": 0,
    "SAGE MODERN": 0,
    "ICE ROYAL": 0,
  };

  for (const c of top) votes[c.style] += 1;

  const styles: BrandStyle[] = ["NOIR ICON", "SAND LUXE", "SAGE MODERN", "ICE ROYAL"];

  // tie-break: distanza media per stile (più bassa = più coerente)
  const avgDist: Record<BrandStyle, number> = {
    "NOIR ICON": 999,
    "SAND LUXE": 999,
    "SAGE MODERN": 999,
    "ICE ROYAL": 999,
  };

  for (const s of styles) {
    const ds = top.filter((t) => t.style === s).map((t) => t.distance);
    avgDist[s] = ds.length ? ds.reduce((a, b) => a + b, 0) / ds.length : 999;
  }

  let bestStyle: BrandStyle = "SAND LUXE";
  for (const s of styles) {
    const betterVotes = votes[s] > votes[bestStyle];
    const tieVotes = votes[s] === votes[bestStyle];
    const betterTie = tieVotes && avgDist[s] < avgDist[bestStyle];
    if (betterVotes || betterTie) bestStyle = s;
  }

  // ordina: prima quelli dello stile bestStyle
  const ordered = [...top].sort((a, b) => {
    const as = a.style === bestStyle ? 0 : 1;
    const bs = b.style === bestStyle ? 0 : 1;
    if (as !== bs) return as - bs;
    return a.distance - b.distance;
  });

  return ordered.map((c) => ({
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
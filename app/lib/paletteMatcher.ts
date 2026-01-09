// app/lib/paletteMatcher.ts
import { hexToLab, deltaE } from "@/app/lib/colorMath";
import { BRAND_COLORS, type BrandColor, type BrandStyle } from "@/app/lib/paletteLibrary";

export type PaletteItem = {
  id: number;     // numero colore (1..48)
  name: string;   // nome wow
  hex: string;    // #RRGGBB
  style: BrandStyle;
};

export type MatchResult = {
  style: BrandStyle;
  colors: PaletteItem[]; // top 5
  debug?: {
    rankedTop10: Array<{ id: number; name: string; hex: string; style: BrandStyle; distance: number }>;
    styleVotes: Record<BrandStyle, number>;
    styleAvgDistance: Record<BrandStyle, number>;
  };
};

function avg(nums: number[]) {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : Number.POSITIVE_INFINITY;
}

export function matchPalette(baseHex: string, topN = 5): MatchResult {
  const baseLab = hexToLab(baseHex);

  // 1) ranking assoluto per DeltaE
  const ranked = BRAND_COLORS
    .map((c) => {
      const d = deltaE(baseLab, hexToLab(c.hex));
      return { ...c, distance: d };
    })
    .sort((a, b) => a.distance - b.distance);

  const picked = ranked.slice(0, topN);

  // 2) deduzione stile: majority vote sui topN
  const styles: BrandStyle[] = ["NOIR ICON", "SAND LUXE", "SAGE MODERN", "ICE ROYAL"];
  const votes: Record<BrandStyle, number> = {
    "NOIR ICON": 0,
    "SAND LUXE": 0,
    "SAGE MODERN": 0,
    "ICE ROYAL": 0,
  };

  for (const c of picked) votes[c.style] += 1;

  // 3) tie-break “intelligente”: distanza media verso lo stile
  // (se parità di voti, scelgo lo stile che in media è più vicino alla pelle)
  const avgDist: Record<BrandStyle, number> = {
    "NOIR ICON": 999,
    "SAND LUXE": 999,
    "SAGE MODERN": 999,
    "ICE ROYAL": 999,
  };

  for (const s of styles) {
    const ds = picked.filter((p) => p.style === s).map((p) => p.distance);
    avgDist[s] = ds.length ? avg(ds) : 999;
  }

  // pick best style: max votes; if tie, min avgDist
  let bestStyle: BrandStyle = "SAND LUXE";
  for (const s of styles) {
    const betterVotes = votes[s] > votes[bestStyle];
    const tieVotes = votes[s] === votes[bestStyle];
    const betterTie = tieVotes && avgDist[s] < avgDist[bestStyle];
    if (betterVotes || betterTie) bestStyle = s;
  }

  const colors: PaletteItem[] = picked.map((c) => ({
    id: c.id,
    name: c.name,
    hex: c.hex.toUpperCase(),
    style: c.style,
  }));

  return {
    style: bestStyle,
    colors,
    debug: {
      rankedTop10: ranked.slice(0, 10).map((c) => ({
        id: c.id,
        name: c.name,
        hex: c.hex.toUpperCase(),
        style: c.style,
        distance: Math.round(c.distance * 100) / 100,
      })),
      styleVotes: votes,
      styleAvgDistance: {
        "NOIR ICON": Math.round(avgDist["NOIR ICON"] * 100) / 100,
        "SAND LUXE": Math.round(avgDist["SAND LUXE"] * 100) / 100,
        "SAGE MODERN": Math.round(avgDist["SAGE MODERN"] * 100) / 100,
        "ICE ROYAL": Math.round(avgDist["ICE ROYAL"] * 100) / 100,
      },
    },
  };
}
"use client";

import React, { useMemo, useState } from "react";
import type { PaletteItem } from "@/app/lib/paletteLogic";

type Props = {
  palette: PaletteItem[];

  /**
   * Oggi: puoi passare il tuo shopUrl (es: https://beorganich.vercel.app/shop)
   * Domani Shopify: metteremo shopDomain (es: https://unyform.myshopify.com)
   */
  shopUrl?: string;

  /**
   * Shopify-ready:
   * - se lo passi, il componente usa questi prodotti
   * - se NON lo passi, usa MOCK
   */
  products?: Product[];

  /**
   * Facoltativo: se vuoi aprire link Shopify diretto /products/handle
   * es: "https://unyform.myshopify.com"
   */
  shopDomain?: string;

  /**
   * Facoltativo: se vuoi filtrare solo alcuni brand
   */
  allowedBrandIds?: string[];
};

export type Product = {
  id: string;

  // multi-brand
  brandId?: string; // chi paga / da chi arriva il prodotto
  brandName?: string;

  // Shopify-ready
  handle?: string; // products/<handle>
  productUrl?: string; // link assoluto (prioritario)
  shopifyProductId?: string;
  shopifyVariantId?: string;

  title: string;
  price: string; // string già formattata
  image: string;

  tags?: string[];

  /**
   * Colore dominante del prodotto (chiave per match)
   * In Shopify lo metteremo come metafield oppure lo calcoliamo da immagini.
   */
  dominantHex?: string;

  /**
   * Se vuoi essere super controllato:
   * mostrare un prodotto solo per certe palette (opzionale)
   */
  allowedPalettes?: string[];

  /**
   * Sponsorizzazione/boost
   * (0 = normale, 1..10 = boost)
   */
  priority?: number;

  /**
   * Shopify-ready:
   * quando importeremo da Shopify: availableForSale / inventory > 0
   */
  inStock?: boolean;
};

// ---------- utils ----------
function cx(...parts: Array<string | false | undefined | null>) {
  return parts.filter(Boolean).join(" ");
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function hexToRgb01(hex: string) {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0");
  const num = parseInt(full, 16);
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  return { r, g, b };
}

function srgbToLinear(c: number) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearRgbToOklab(r: number, g: number, b: number) {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

function hexToOklab(hex: string) {
  const { r, g, b } = hexToRgb01(hex);
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  return linearRgbToOklab(lr, lg, lb);
}

function deltaE_OkLab(hexA: string, hexB: string) {
  const A = hexToOklab(hexA);
  const B = hexToOklab(hexB);
  const dL = A.L - B.L;
  const da = A.a - B.a;
  const db = A.b - B.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

/**
 * Match “premium”:
 * - usa deltaE (OKLab) verso palette
 * - curva realistica (no 100% facili)
 * - penalizza se manca colore prodotto
 */
function computeColorMatchScore01(dominantHex: string | undefined, paletteHexes: string[]) {
  // se non abbiamo colore prodotto => NON sparare alto
  if (!dominantHex || !paletteHexes.length) {
    return { score01: 0.72, bestDelta: 0.18 };
  }

  let best = Infinity;
  for (const u of paletteHexes) {
    const d = deltaE_OkLab(dominantHex, u);
    if (d < best) best = d;
  }

  // normalizzazione “fashion”: 0.00 perfetto -> 0.22 troppo distante
  const n = clamp(best / 0.22, 0, 1);

  // curva più “vera”: rende difficili i 95+
  const curved = 1 - Math.pow(n, 1.45);

  // clamp realistica
  const score01 = clamp(curved, 0.60, 0.95);

  return { score01, bestDelta: best };
}

/**
 * Boost “sponsor” leggero:
 * - NON deve far salire roba non coerente
 */
function applySponsorBoost(score01: number, priority?: number) {
  const p = clamp(priority ?? 0, 0, 10);
  const boost = (p / 10) * 0.06; // max +6%
  return clamp(score01 + boost, 0.60, 0.96);
}

function scoreToPct(score01: number) {
  // range umano, evita 100%
  return clamp(Math.round(score01 * 100), 60, 96);
}

function matchLabel(pct: number) {
  if (pct >= 90) return "Match perfetto";
  if (pct >= 80) return "Match ottimo";
  if (pct >= 70) return "Match buono";
  return "Match OK";
}

function buildProductHref(p: Product, shopUrl?: string, shopDomain?: string) {
  // priorità: productUrl assoluto
  if (p.productUrl) return p.productUrl;

  // Shopify-ready: handle
  if (shopDomain && p.handle) {
    const clean = shopDomain.replace(/\/$/, "");
    return `${clean}/products/${p.handle}`;
  }

  // fallback: il tuo shopUrl generico
  if (shopUrl) return shopUrl.replace(/\/$/, "");

  return "#";
}

/**
 * Top picks “intelligente”:
 * - prende massimo 1 prodotto per colore della palette (finché può)
 * - poi riempie
 * Così non ti mostra 4 capi praticamente uguali.
 */
function selectTopPicksDiversified(
  ranked: Array<Product & { _score01: number; _pct: number; _bestDelta: number }>,
  paletteHexes: string[],
  count: number
) {
  if (!ranked.length) return [];

  const used = new Set<string>();
  const out: typeof ranked = [];

  // 1) pass: prova a prendere 1 per colore (il più vicino a quel colore)
  for (const targetHex of paletteHexes) {
    if (out.length >= count) break;

    // tra i prodotti NON usati, scegli quello con delta min verso targetHex
    let bestIdx = -1;
    let bestD = Infinity;

    ranked.forEach((p, idx) => {
      if (used.has(p.id)) return;
      if (!p.dominantHex) return;
      const d = deltaE_OkLab(p.dominantHex, targetHex);
      if (d < bestD) {
        bestD = d;
        bestIdx = idx;
      }
    });

    if (bestIdx >= 0) {
      const pick = ranked[bestIdx];
      used.add(pick.id);
      out.push(pick);
    }
  }

  // 2) fill: completa con ranking generale
  for (const p of ranked) {
    if (out.length >= count) break;
    if (used.has(p.id)) continue;
    out.push(p);
    used.add(p.id);
  }

  return out;
}

// ---------- MOCK (oggi) ----------
const MOCK: Product[] = [
  {
    id: "p1",
    brandId: "unyform",
    brandName: "UNYFORM",
    title: "365 Midweight Hoodie",
    price: "€129",
    image:
      "https://images.unsplash.com/photo-1520975958225-2f83f0d94cf9?auto=format&fit=crop&w=1400&q=80",
    handle: "365-midweight-hoodie",
    tags: ["Organic", "Essential"],
    dominantHex: "#2F2B28",
    inStock: true,
    priority: 0,
  },
  {
    id: "p2",
    brandId: "unyform",
    brandName: "UNYFORM",
    title: "Relaxed Tee — Premium Cotton",
    price: "€59",
    image:
      "https://images.unsplash.com/photo-1520975682032-1f0e6f4c7d1b?auto=format&fit=crop&w=1400&q=80",
    handle: "relaxed-tee",
    tags: ["Soft", "Daily"],
    dominantHex: "#E7DFD5",
    inStock: true,
  },
  {
    id: "p3",
    brandId: "unyform",
    brandName: "UNYFORM",
    title: "Minimal Knit",
    price: "€149",
    image:
      "https://images.unsplash.com/photo-1520975869018-6d4b2e77f7d1?auto=format&fit=crop&w=1400&q=80",
    handle: "minimal-knit",
    tags: ["Warm", "Luxury"],
    dominantHex: "#CBB2A3",
    inStock: true,
  },
  {
    id: "p4",
    brandId: "unyform",
    brandName: "UNYFORM",
    title: "Tailored Pants",
    price: "€119",
    image:
      "https://images.unsplash.com/photo-1520975854868-9e4f2c1d8a44?auto=format&fit=crop&w=1400&q=80",
    handle: "tailored-pants",
    tags: ["Clean", "Smart"],
    dominantHex: "#1C2430",
    inStock: true,
  },
  {
    id: "p5",
    brandId: "unyform",
    brandName: "UNYFORM",
    title: "Overshirt — Organic",
    price: "€139",
    image:
      "https://images.unsplash.com/photo-1520975723012-44d3a0e2e9a1?auto=format&fit=crop&w=1400&q=80",
    handle: "overshirt-organic",
    tags: ["Layer", "Premium"],
    dominantHex: "#9AA39A",
    inStock: true,
  },
  {
    id: "p6",
    brandId: "unyform",
    brandName: "UNYFORM",
    title: "Essential Crewneck",
    price: "€99",
    image:
      "https://images.unsplash.com/photo-1520975960127-2d5e51f9bfa4?auto=format&fit=crop&w=1400&q=80",
    handle: "essential-crewneck",
    tags: ["Core", "Best Seller"],
    dominantHex: "#C7A78F",
    inStock: true,
  },
];

// ---------- COMPONENT ----------
export default function ProductsCarousel({
  palette,
  shopUrl,
  products,
  shopDomain,
  allowedBrandIds,
}: Props) {
  const [active, setActive] = useState<"top" | "all">("top");

  const paletteHexes = useMemo(() => palette.map((x) => x.hex), [palette]);

  const source = useMemo(() => products?.length ? products : MOCK, [products]);

  const ranked = useMemo(() => {
    const filtered = source
      // 1) stock (se inStock è definito)
      .filter((p) => (typeof p.inStock === "boolean" ? p.inStock : true))
      // 2) multi-brand allowlist
      .filter((p) => (allowedBrandIds?.length ? !!p.brandId && allowedBrandIds.includes(p.brandId) : true))
      // 3) palette allowlist (se usi allowedPalettes)
      .filter((p) => (p.allowedPalettes?.length ? p.allowedPalettes.includes("ANY") : true));

    const scored = filtered.map((p) => {
      const base = computeColorMatchScore01(p.dominantHex, paletteHexes);
      const boosted = applySponsorBoost(base.score01, p.priority);

      return {
        ...p,
        _bestDelta: base.bestDelta,
        _score01: boosted,
        _pct: scoreToPct(boosted),
      };
    });

    // qualità: non mostrare roba troppo lontana
    const quality = scored.filter((p) => p._score01 >= 0.66);

    // ranking finale
    quality.sort((a, b) => b._score01 - a._score01);

    return quality;
  }, [source, paletteHexes, allowedBrandIds]);

  const topPicks = useMemo(() => selectTopPicksDiversified(ranked, paletteHexes, 4), [ranked, paletteHexes]);

  const shown = active === "top" ? topPicks : ranked;

  if (!shown.length) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <div className="text-[16px] font-semibold text-white/90">Capi consigliati</div>
        <div className="mt-2 text-[12px] text-white/55">
          Non ho trovato capi abbastanza coerenti con questa palette. Prova a rifare lo scan o cambia luce.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      {/* HEADER */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[16px] sm:text-[18px] font-semibold text-white/90">
            Capi consigliati
          </div>
          <div className="mt-1 text-[12px] text-white/55">
            Selezionati in base alla tua palette. Solo match realmente coerenti.
          </div>
        </div>

        {/* Tabs premium */}
        <div className="inline-flex rounded-full border border-white/10 bg-black/20 p-1">
          <button
            type="button"
            onClick={() => setActive("top")}
            className={cx(
              "h-9 rounded-full px-4 text-[12px] font-semibold transition",
              active === "top" ? "bg-white text-black" : "text-white/75 hover:bg-white/[0.06]"
            )}
            aria-pressed={active === "top"}
          >
            Top picks
          </button>
          <button
            type="button"
            onClick={() => setActive("all")}
            className={cx(
              "h-9 rounded-full px-4 text-[12px] font-semibold transition",
              active === "all" ? "bg-white text-black" : "text-white/75 hover:bg-white/[0.06]"
            )}
            aria-pressed={active === "all"}
          >
            Tutti
          </button>
        </div>
      </div>

      {/* GRID */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {shown.map((p, idx) => {
          const pct = p._pct;
          const label = matchLabel(pct);

          const isHero = active === "top" && idx === 0;

          const href = buildProductHref(p, shopUrl, shopDomain);

          return (
            <a
              key={p.id}
              href={href}
              target={href.startsWith("http") ? "_blank" : undefined}
              rel={href.startsWith("http") ? "noreferrer" : undefined}
              className={cx(
                "group relative overflow-hidden rounded-3xl border border-white/10 bg-black/20",
                "hover:border-white/20 hover:bg-white/[0.04] transition",
                "active:scale-[0.99]",
                isHero && "sm:col-span-2"
              )}
              role="listitem"
              aria-label={`Apri ${p.title}`}
            >
              {/* IMAGE */}
              <div className={cx("relative", isHero ? "h-[240px] sm:h-[280px]" : "h-[200px]")}>
                <img
                  src={p.image}
                  alt={p.title}
                  loading="lazy"
                  className="h-full w-full object-cover opacity-[0.92] transition duration-500 group-hover:opacity-100 group-hover:scale-[1.02]"
                />

                {/* gradient */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

                {/* Match badge */}
                <div className="absolute right-4 top-4 rounded-2xl border border-white/12 bg-black/45 px-3 py-2 backdrop-blur">
                  <div className="text-[14px] font-semibold text-white/90 leading-none">{pct}%</div>
                  <div className="mt-1 text-[11px] text-white/60 leading-none">{label}</div>
                </div>

                {/* Color chip */}
                {p.dominantHex && (
                  <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/45 px-3 py-2 backdrop-blur">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.dominantHex }} />
                    <span className="text-[11px] font-mono text-white/70">{p.dominantHex.toUpperCase()}</span>
                  </div>
                )}

                {/* Match bar */}
                <div className="absolute left-4 right-4 bottom-4">
                  <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-white/60" style={{ width: `${pct}%` }} aria-hidden />
                  </div>
                </div>
              </div>

              {/* BODY */}
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[14px] sm:text-[15px] font-semibold text-white/90 truncate">
                      {p.title}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-white/60">
                      <span className="font-semibold text-white/80">{p.price}</span>

                      {!!p.tags?.length && (
                        <span className="inline-flex flex-wrap gap-2">
                          {p.tags.slice(0, 2).map((t) => (
                            <span
                              key={t}
                              className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-white/60"
                            >
                              {t}
                            </span>
                          ))}
                        </span>
                      )}

                      {p.brandName && (
                        <span className="rounded-full border border-white/10 bg-white/[0.02] px-2 py-1 text-[11px] text-white/55">
                          {p.brandName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="shrink-0">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-[12px] font-semibold text-black transition group-hover:bg-white/90">
                      Apri <span aria-hidden>→</span>
                    </div>
                  </div>
                </div>

                {isHero && (
                  <div className="mt-3 text-[12px] leading-6 text-white/55">
                    Primo consiglio: è il capo più coerente con la tua palette. Se vuoi andare “sul sicuro”, parti da qui.
                  </div>
                )}
              </div>
            </a>
          );
        })}
      </div>

      {/* FOOTNOTE */}
      <div className="mt-4 text-[12px] text-white/45">
        Matching colore basato su DeltaE (OKLab) + curva realistica. Quando colleghiamo Shopify: stock reale + metafields colore + link diretto al prodotto.
      </div>
    </div>
  );
}
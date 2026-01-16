"use client";

import React, { useMemo, useState } from "react";
import type { PaletteItem } from "@/app/lib/paletteLogic";

type Props = {
  palette: PaletteItem[];
  shopUrl: string;
};

type Product = {
  id: string;
  title: string;
  price: string;
  image: string;
  handle?: string;
  tags?: string[];
  hex?: string; // colore stimato del capo
};

function cx(...parts: Array<string | false | undefined | null>) {
  return parts.filter(Boolean).join(" ");
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0");
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return { r, g, b };
}

function colorDistance(a: string, b: string) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const dr = A.r - B.r;
  const dg = A.g - B.g;
  const db = A.b - B.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function bestMatchScore(productHex: string | undefined, palette: PaletteItem[]) {
  if (!productHex || !palette?.length) return 0;

  let best = Number.POSITIVE_INFINITY;
  for (const p of palette) best = Math.min(best, colorDistance(productHex, p.hex));

  // normalizza: 0..1 (più alto = meglio)
  const norm = clamp(best / 220, 0, 1);
  return 1 - norm;
}

function productUrl(shopUrl: string, handle?: string) {
  // ✅ oggi non hai Shopify: apriamo lo shop generico.
  // Quando avrai Shopify, cambia a:
  // const clean = shopUrl.replace(/\/$/, "");
  // return handle ? `${clean}/products/${handle}` : clean;
  const clean = shopUrl.replace(/\/$/, "");
  return clean;
}

/** Mock prodotti (come avevi tu) */
const MOCK: Product[] = [
  {
    id: "p1",
    title: "365 Midweight Hoodie",
    price: "€129",
    image:
      "https://images.unsplash.com/photo-1520975958225-2f83f0d94cf9?auto=format&fit=crop&w=1400&q=80",
    handle: "365-midweight-hoodie",
    tags: ["Organic", "Essential"],
    hex: "#2F2B28",
  },
  {
    id: "p2",
    title: "Relaxed Tee — Premium Cotton",
    price: "€59",
    image:
      "https://images.unsplash.com/photo-1520975682032-1f0e6f4c7d1b?auto=format&fit=crop&w=1400&q=80",
    handle: "relaxed-tee",
    tags: ["Soft", "Daily"],
    hex: "#E7DFD5",
  },
  {
    id: "p3",
    title: "Minimal Knit",
    price: "€149",
    image:
      "https://images.unsplash.com/photo-1520975869018-6d4b2e77f7d1?auto=format&fit=crop&w=1400&q=80",
    handle: "minimal-knit",
    tags: ["Warm", "Luxury"],
    hex: "#CBB2A3",
  },
  {
    id: "p4",
    title: "Tailored Pants",
    price: "€119",
    image:
      "https://images.unsplash.com/photo-1520975854868-9e4f2c1d8a44?auto=format&fit=crop&w=1400&q=80",
    handle: "tailored-pants",
    tags: ["Clean", "Smart"],
    hex: "#1C2430",
  },
  {
    id: "p5",
    title: "Overshirt — Organic",
    price: "€139",
    image:
      "https://images.unsplash.com/photo-1520975723012-44d3a0e2e9a1?auto=format&fit=crop&w=1400&q=80",
    handle: "overshirt-organic",
    tags: ["Layer", "Premium"],
    hex: "#9AA39A",
  },
  {
    id: "p6",
    title: "Essential Crewneck",
    price: "€99",
    image:
      "https://images.unsplash.com/photo-1520975960127-2d5e51f9bfa4?auto=format&fit=crop&w=1400&q=80",
    handle: "essential-crewneck",
    tags: ["Core", "Best Seller"],
    hex: "#C7A78F",
  },
];

function matchLabel(pct: number) {
  if (pct >= 88) return "Match perfetto";
  if (pct >= 74) return "Match ottimo";
  if (pct >= 60) return "Match buono";
  return "Match OK";
}

export default function ProductsCarousel({ palette, shopUrl }: Props) {
  const [active, setActive] = useState<"top" | "all">("top");

  const ranked = useMemo(() => {
    return MOCK.map((p) => {
      const score = bestMatchScore(p.hex, palette);
      return { ...p, _score: score };
    }).sort((a, b) => (b as any)._score - (a as any)._score);
  }, [palette]);

  const topPicks = useMemo(() => ranked.slice(0, 4), [ranked]);
  const shown = active === "top" ? topPicks : ranked;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      {/* HEADER */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[16px] sm:text-[18px] font-semibold text-white/90">
            Match capi consigliati
          </div>
          <div className="mt-1 text-[12px] text-white/55">
            Selezionati in base ai colori della tua palette. Clicca e apri.
          </div>
        </div>

        {/* Tabs premium */}
        <div className="inline-flex rounded-full border border-white/10 bg-black/20 p-1">
          <button
            type="button"
            onClick={() => setActive("top")}
            className={cx(
              "h-9 rounded-full px-4 text-[12px] font-semibold transition",
              active === "top"
                ? "bg-white text-black"
                : "text-white/75 hover:bg-white/[0.06]"
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
              active === "all"
                ? "bg-white text-black"
                : "text-white/75 hover:bg-white/[0.06]"
            )}
            aria-pressed={active === "all"}
          >
            Tutti
          </button>
        </div>
      </div>

      {/* ROW */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {shown.map((p, idx) => {
          const score = (p as any)._score as number;
          const pct = Math.round(clamp(score, 0, 1) * 100);
          const label = matchLabel(pct);

          // Hero solo per il primo dei Top picks
          const isHero = active === "top" && idx === 0;

          return (
            <a
              key={p.id}
              href={productUrl(shopUrl, p.handle)}
              target="_blank"
              rel="noreferrer"
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

                {/* soft gradient */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

                {/* Match badge */}
                <div className="absolute right-4 top-4 rounded-2xl border border-white/12 bg-black/45 px-3 py-2 backdrop-blur">
                  <div className="text-[14px] font-semibold text-white/90 leading-none">{pct}%</div>
                  <div className="mt-1 text-[11px] text-white/60 leading-none">{label}</div>
                </div>

                {/* Color chip */}
                {p.hex && (
                  <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/45 px-3 py-2 backdrop-blur">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.hex }} />
                    <span className="text-[11px] font-mono text-white/70">{p.hex.toUpperCase()}</span>
                  </div>
                )}

                {/* Match bar */}
                <div className="absolute left-4 right-4 bottom-4">
                  <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-white/60"
                      style={{ width: `${clamp(pct, 0, 100)}%` }}
                      aria-hidden
                    />
                  </div>
                </div>
              </div>

              {/* BODY */}
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[14px] sm:text-[15px] font-semibold text-white/90">
                      {p.title}
                    </div>

                    <div className="mt-1 flex items-center gap-2 text-[12px] text-white/60">
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
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="shrink-0">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-[12px] font-semibold text-black transition group-hover:bg-white/90">
                      Apri capo <span aria-hidden>→</span>
                    </div>
                  </div>
                </div>

                {isHero && (
                  <div className="mt-3 text-[12px] leading-6 text-white/55">
                    Questo è il capo più coerente con la tua palette. Se vuoi andare “sul sicuro”, parti da qui.
                  </div>
                )}
              </div>
            </a>
          );
        })}
      </div>

      {/* FOOTNOTE */}
      <div className="mt-4 text-[12px] text-white/45">
        * Matching colore “light” (mock). Quando colleghiamo Shopify lo rendiamo ultra preciso (DeltaE + immagini prodotto).
      </div>
    </div>
  );
}
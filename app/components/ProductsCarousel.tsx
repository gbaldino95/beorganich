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
  // colore “dominante” del capo (mock). Quando avremo Shopify lo calcoliamo meglio.
  hex?: string;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "").trim();
  const full =
    h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0");
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return { r, g, b };
}

function colorDistance(a: string, b: string) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  // Euclidean (buono e veloce). Quando mettiamo Shopify possiamo passare a DeltaE.
  const dr = A.r - B.r;
  const dg = A.g - B.g;
  const db = A.b - B.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function bestMatchScore(productHex: string | undefined, palette: PaletteItem[]) {
  if (!productHex || !palette?.length) return 0;
  let best = Number.POSITIVE_INFINITY;
  for (const p of palette) {
    best = Math.min(best, colorDistance(productHex, p.hex));
  }
  // normalizza: 0 (perfetto) -> 1 (scarso)
  // dist max ~ 441; noi lo “stringiamo” per renderlo più sensibile
  const norm = clamp(best / 220, 0, 1);
  // score 1..0
  return 1 - norm;
}

function productUrl(shopUrl: string, handle?: string) {
  // ✅ TEMP: non hai Shopify -> manda allo shop URL e non si rompe nulla
  // Quando mi dai Shopify, torniamo a: `${clean}/products/${handle}`
  const clean = shopUrl.replace(/\/$/, "");
  if (!handle) return clean;
  return clean;
}

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

export default function ProductsCarousel({ palette, shopUrl }: Props) {
  const [active, setActive] = useState<"top" | "all">("top");

  const ranked = useMemo(() => {
    // rank by palette match
    const list = MOCK.map((p) => {
      const score = bestMatchScore(p.hex, palette);
      return { ...p, _score: score };
    }).sort((a, b) => b._score - a._score);

    return list;
  }, [palette]);

  const topPicks = useMemo(() => ranked.slice(0, 4), [ranked]);
  const shown = active === "top" ? topPicks : ranked;

  return (
    <div className="beoPC">
      <div className="beoPCHead">
        <div className="beoPCTitle">Capi consigliati per la tua palette</div>
        <div className="beoPCSub">
          Selezione rapida: pochi pezzi, massima coerenza.
        </div>

        <div className="beoPCTabs">
          <button
            type="button"
            onClick={() => setActive("top")}
            className={active === "top" ? "beoTab active" : "beoTab"}
          >
            Top Picks
          </button>
          <button
            type="button"
            onClick={() => setActive("all")}
            className={active === "all" ? "beoTab active" : "beoTab"}
          >
            Tutti
          </button>
        </div>
      </div>

      <div className="beoRow" role="list">
        {shown.map((p, idx) => {
          const score = (p as any)._score as number;
          const pct = Math.round(clamp(score, 0, 1) * 100);

          const badge =
            pct >= 85 ? "Perfetto" : pct >= 70 ? "Ottimo" : pct >= 55 ? "Buono" : "OK";

          return (
            <a
              key={p.id}
              role="listitem"
              href={productUrl(shopUrl, p.handle)}
              target="_blank"
              rel="noreferrer"
              className={cx("beoCard", idx === 0 && active === "top" && "beoCardHero")}
            >
              <div className="beoImgWrap">
                <img className="beoImg" src={p.image} alt={p.title} loading="lazy" />
                <div className="beoFade" />

                <div className="beoTopRight">
                  <div className="beoMatch">
                    <div className="beoMatchPct">{pct}%</div>
                    <div className="beoMatchLbl">{badge}</div>
                  </div>
                </div>

                {p.hex && (
                  <div className="beoColorChip" title="colore stimato">
                    <span className="beoChipDot" style={{ background: p.hex }} />
                    <span className="beoChipTxt">{p.hex.toUpperCase()}</span>
                  </div>
                )}
              </div>

              <div className="beoBody">
                <div className="beoName">{p.title}</div>
                <div className="beoMeta">
                  <span className="beoPrice">{p.price}</span>
                  {!!p.tags?.length && (
                    <span className="beoTags">
                      {p.tags.slice(0, 2).map((t) => (
                        <span key={t} className="beoTag">
                          {t}
                        </span>
                      ))}
                    </span>
                  )}
                </div>

                <div className="beoCtaRow">
                  <span className="beoCta">Apri</span>
                  <span className="beoArrow">→</span>
                </div>
              </div>
            </a>
          );
        })}
      </div>

      <div className="beoPCFoot">
        <div className="beoPCNote">
          * Matching colore “light” (mock). Quando mi dai Shopify lo rendiamo ultra preciso.
        </div>
      </div>
    </div>
  );
}

function cx(...parts: Array<string | false | undefined | null>) {
  return parts.filter(Boolean).join(" ");
}
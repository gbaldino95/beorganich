"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import ProductCarousel from "@/app/components/ProductsCarousel";
import SharePalette from "@/app/components/SharePalette";
import EmailGate from "@/app/components/EmailGate";

import {
  buildShopifyDeepLink,
  buildShareUrl,
  getStyleInsight,
  type PaletteItem,
} from "@/app/lib/paletteLogic";

import type { BrandStyle } from "@/app/lib/paletteLibrary";

const BRAND = "BEORGANICH";
const SHOP_URL = "https://shop.beorganich-example.com";
const SHARE_BASE_URL = "https://beorganich-example.vercel.app";
const LAST_KEY = "beorganich:lastPalette:v1";

// ✅ Safe su Vercel/build: localStorage solo in browser
function loadLastPalette(): PaletteItem[] | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(LAST_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed?.palette?.length) return null;

    return parsed.palette as PaletteItem[];
  } catch {
    return null;
  }
}

// micro helper
function cx(...parts: Array<string | false | undefined | null>) {
  return parts.filter(Boolean).join(" ");
}

export default function ResultClient() {
  const [palette, setPalette] = useState<PaletteItem[] | null>(null);

  // ✅ quando ScanClient fa /result?ts=..., qui cambia e ricarichiamo
  const searchParams = useSearchParams();
  const ts = searchParams.get("ts");

  useEffect(() => {
    const last = loadLastPalette();
    setPalette(last);
  }, [ts]);

  const shareUrl = useMemo(
    () => buildShareUrl(SHARE_BASE_URL, palette ?? [], BRAND),
    [palette]
  );

  const shopDeepLink = useMemo(
    () => buildShopifyDeepLink(SHOP_URL, palette ?? []),
    [palette]
  );

  const onOpenShop = useCallback(() => {
    if (typeof window === "undefined") return;
    window.open(shopDeepLink || SHOP_URL, "_blank", "noreferrer");
  }, [shopDeepLink]);

  const style: BrandStyle = useMemo(
    () => (palette?.[0]?.style ?? "SAND LUXE") as BrandStyle,
    [palette]
  );
  const insight = useMemo(() => getStyleInsight(style), [style]);

  if (!palette) {
    return (
      <div className="min-h-dvh bg-black text-white">
        <header className="mx-auto flex max-w-5xl items-center justify-between px-5 pt-6">
          <div className="text-[12px] tracking-[0.22em] text-white/70">{BRAND}</div>
          <Link className="pillButton subtle" href="/">
            Home
          </Link>
        </header>

        <main className="mx-auto max-w-5xl px-5 pb-28 pt-16">
          <div className="card">
            <div className="cardTitle">Nessun risultato disponibile</div>
            <div className="cardText">
              Fai uno scan o carica una foto per generare la tua palette.
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Link
                href="/scan"
                className="h-12 rounded-2xl bg-white text-black text-[14px] font-semibold grid place-items-center"
              >
                Effettua lo scan
              </Link>
              <Link
                href="/scan?upload=1"
                className="h-12 rounded-2xl border border-white/20 text-[14px] grid place-items-center text-white/85 hover:bg-white/[0.06] transition"
              >
                Carica una foto
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-black text-white">
      <div className="beoAurora" aria-hidden />
      <div className="beoNoise" aria-hidden />

      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 pt-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="text-[12px] tracking-[0.22em] text-white/70">{BRAND}</div>
          <div className="pill">Risultato</div>
          <div className="pill subtle">✓ salvato</div>
        </div>

        <div className="flex items-center gap-2">
          <button className="pillButton" onClick={onOpenShop}>
            Shop
          </button>
          <Link className="pillButton subtle" href="/">
            Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-[calc(env(safe-area-inset-bottom)+120px)] pt-10 relative z-10">
        <section className="beoEnter">
          <div className="resultHero2">
            <div className="resultHeroBadge">
              Analisi completata <span className="resultHeroDot" aria-hidden />
              Palette pronta
            </div>

            <div className="mt-4 inline-flex items-center gap-2">
              <span className="pill">{insight.displayName}</span>
              <span className="pill subtle">stile dominante</span>
            </div>

            <h1 className="resultHeroTitle2 mt-4">{insight.title}</h1>

            <p className="resultHeroSub2">
              {insight.subtitle}{" "}
              <span className="text-white/85 font-medium">{insight.hook}</span>
            </p>

            <div className="resultHeroCtas">
              <button onClick={onOpenShop} className="resultHeroPrimary">
                {insight.cta}
              </button>

              <Link href="/scan" className="resultHeroSecondary">
                Rifai scan
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-7">
          <div className="resultCard2">
            <div className="resultCardTop2">
              <div>
                <div className="resultCardTitle2">La tua palette personale</div>
                <div className="resultCardHint2">
                  Regola semplice: quando sei indeciso, scegli un colore dentro questa lista.
                </div>
              </div>

              <button onClick={onOpenShop} className="resultPrimaryCta2">
                Vedi i capi →
              </button>
            </div>

            <div className="resultSwatches2">
              {palette.map((p) => (
                <div key={`${p.hex}-${p.id ?? ""}`} className="resultSwatch2">
                  <div className="resultSwatchColor2" style={{ background: p.hex }} />
                  <div className="resultSwatchMeta2">
                    <div className="resultSwatchName2">{p.name}</div>
                    <div className="resultSwatchHex2">{p.hex.toUpperCase()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="resultSection2">
          <div className="resultSectionHead2">
            <div>
              <div className="resultSectionTitle2">Capi selezionati per la tua palette</div>
              <div className="resultSectionSub2">Selezione coerente con i tuoi toni naturali.</div>
            </div>

            <button onClick={onOpenShop} className="resultMiniCta2">
              Apri shop →
            </button>
          </div>

          <div className="resultSectionCard2">
            <ProductCarousel palette={palette} shopUrl={SHOP_URL} />
          </div>

          <button onClick={onOpenShop} className="resultBigShopCta2">
            Vai ai capi consigliati →
          </button>
        </section>

        <section className="resultSection2">
          <div className="resultSectionHead2">
            <div>
              <div className="resultSectionTitle2">Salva e condividi</div>
              <div className="resultSectionSub2">
                Tieni il risultato a portata di mano e ricevi nuove uscite coerenti.
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="resultSectionCard2">
              <SharePalette palette={palette} shareUrl={shareUrl} title={`${BRAND} — Palette`} />
            </div>
            <div className="resultSectionCard2">
              <EmailGate palette={palette} />
            </div>
          </div>
        </section>
      </main>

      <div className="resultSticky2">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5">
          <Link href="/scan" className="resultGhostBtn2">
            Rifai scan
          </Link>

          <button onClick={onOpenShop} className={cx("resultStickyBtn2")}>
            {insight.cta}
          </button>
        </div>
      </div>
    </div>
  );
}
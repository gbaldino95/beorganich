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

// fallback RAM (in caso localStorage non leggibile)
let MEMORY_LAST: PaletteItem[] | null = null;

function loadLastPalette(): PaletteItem[] | null {
  if (MEMORY_LAST?.length) return MEMORY_LAST;
  try {
    const raw = localStorage.getItem(LAST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.palette?.length) return null;
    MEMORY_LAST = parsed.palette as PaletteItem[];
    return MEMORY_LAST;
  } catch {
    return null;
  }
}

function cx(...parts: Array<string | false | undefined | null>) {
  return parts.filter(Boolean).join(" ");
}

function confidenceCopy(conf?: number) {
  if (typeof conf !== "number") return "Analisi completata";
  if (conf >= 86) return "Analisi molto stabile";
  if (conf >= 72) return "Analisi stabile";
  if (conf >= 58) return "Analisi buona";
  return "Analisi ok";
}

export default function ResultPage() {
  const [palette, setPalette] = useState<PaletteItem[] | null>(null);
  const [meta, setMeta] = useState<any | null>(null);

  const searchParams = useSearchParams();
  const ts = searchParams.get("ts");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_KEY);
      if (!raw) {
        const last = loadLastPalette();
        setPalette(last);
        setMeta(null);
        return;
      }
      const parsed = JSON.parse(raw);
      setPalette(parsed?.palette?.length ? (parsed.palette as PaletteItem[]) : null);
      setMeta(parsed?.meta ?? null);
    } catch {
      const last = loadLastPalette();
      setPalette(last);
      setMeta(null);
    }
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
    window.open(shopDeepLink || SHOP_URL, "_blank", "noreferrer");
  }, [shopDeepLink]);

  const style: BrandStyle = useMemo(
    () => (palette?.[0]?.style ?? "SAND LUXE") as BrandStyle,
    [palette]
  );
  const insight = useMemo(() => getStyleInsight(style), [style]);

  const conf = typeof meta?.confidence === "number" ? meta.confidence : undefined;
  const method = meta?.method === "camera" ? "scan" : meta?.method === "upload" ? "foto" : null;

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
            <div className="cardText">Fai uno scan o carica una foto per generare la tua palette.</div>

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
      {/* Background premium */}
      <div className="beoAurora" aria-hidden />
      <div className="beoNoise" aria-hidden />

      {/* HEADER */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 pt-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="text-[12px] tracking-[0.22em] text-white/70">{BRAND}</div>
          <div className="resultTopChip">RISULTATO</div>
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

      <main className="mx-auto max-w-5xl px-5 pb-[calc(env(safe-area-inset-bottom)+140px)] pt-10 relative z-10">
        {/* HERO – conversion */}
        <section className="resultHeroX">
          <div className="resultHeroXBadge">
            {confidenceCopy(conf)}
            <span className="resultHeroXDot" aria-hidden />
            {method ? `da ${method}` : "pronto"}
          </div>

          <div className="mt-4 inline-flex items-center gap-2">
            <span className="resultHeroXTag">{insight.displayName}</span>
            <span className="resultHeroXTag subtle">stile dominante</span>
          </div>

          <h1 className="resultHeroXTitle mt-4">{insight.title}</h1>

          <p className="resultHeroXSub">
            {insight.subtitle}{" "}
            <span className="text-white/90 font-medium">{insight.hook}</span>
          </p>

          <div className="resultHeroXCtas">
            <button onClick={onOpenShop} className="resultHeroXPrimary">
              Vedi i capi perfetti →
            </button>

            <Link href="/scan" className="resultHeroXSecondary">
              Rifai scan
            </Link>
          </div>

          <div className="resultHeroXProof">
            <div className="resultHeroXProofItem">Palette personale</div>
            <span className="resultHeroXProofSep">•</span>
            <div className="resultHeroXProofItem">Selezione capi coerente</div>
            <span className="resultHeroXProofSep">•</span>
            <div className="resultHeroXProofItem">Nessuna foto salvata</div>
          </div>
        </section>

        {/* PALETTE – ultra clean */}
        <section className="mt-7">
          <div className="resultCardX">
            <div className="resultCardXTop">
              <div>
                <div className="resultCardXTitle">La tua palette personale</div>
                <div className="resultCardXHint">
                  Regola d’oro: se sei indeciso, scegli un colore qui dentro.
                </div>
              </div>

              <button onClick={onOpenShop} className="resultCardXCta">
                Vai allo shop →
              </button>
            </div>

            <div className="resultSwatchesX">
              {palette.map((p) => (
                <div key={`${p.hex}-${p.id ?? ""}`} className="resultSwatchX">
                  <div className="resultSwatchXColor" style={{ background: p.hex }} />
                  <div className="resultSwatchXMeta">
                    <div className="resultSwatchXName">{p.name}</div>
                    <div className="resultSwatchXHex">{p.hex.toUpperCase()}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* micro conversion copy */}
            <div className="resultWhyX">
              <div className="resultWhyXTitle">Perché questi colori ti valorizzano</div>
              <div className="resultWhyXGrid">
                <div className="resultWhyXItem">
                  <div className="resultWhyXStrong">Più luminosità</div>
                  <div className="resultWhyXText">Toni che non “spengono” la pelle: viso più pulito, più vivo.</div>
                </div>
                <div className="resultWhyXItem">
                  <div className="resultWhyXStrong">Contrasto giusto</div>
                  <div className="resultWhyXText">Eviti colori che ti induriscono o ti rendono “grigio”.</div>
                </div>
                <div className="resultWhyXItem">
                  <div className="resultWhyXStrong">Scelta facile</div>
                  <div className="resultWhyXText">Meno dubbi quando compri: prendi capi già coerenti.</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PRODUCTS – shop-first */}
        <section className="resultSectionX">
          <div className="resultSectionXHead">
            <div>
              <div className="resultSectionXTitle">Capi selezionati per la tua palette</div>
              <div className="resultSectionXSub">Apri lo shop con i filtri già pronti.</div>
            </div>

            <button onClick={onOpenShop} className="resultMiniCtaX">
              Apri shop →
            </button>
          </div>

          <div className="resultSectionXCard">
            <ProductCarousel palette={palette} shopUrl={SHOP_URL} />
          </div>

          <button onClick={onOpenShop} className="resultBigShopCtaX">
            Vai ai capi consigliati →
          </button>
        </section>

        {/* SAVE + SHARE */}
        <section className="resultSectionX">
          <div className="resultSectionXHead">
            <div>
              <div className="resultSectionXTitle">Salva e condividi</div>
              <div className="resultSectionXSub">Tienila a portata di mano. (Zero foto salvate.)</div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="resultSectionXCard">
              <SharePalette palette={palette} shareUrl={shareUrl} title={`${BRAND} — Palette`} />
            </div>
            <div className="resultSectionXCard">
              <EmailGate palette={palette} />
            </div>
          </div>
        </section>
      </main>

      {/* STICKY – conversion */}
      <div className="resultStickyX">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5">
          <Link href="/scan" className="resultGhostBtnX">
            Rifai scan
          </Link>

          <button onClick={onOpenShop} className={cx("resultStickyBtnX")}>
            Vedi i capi perfetti →
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

// ✅ usa il tuo componente
import ProductsCarousel from "@/app/components/ProductsCarousel";
import type { PaletteItem } from "@/app/lib/paletteLogic";

type PaletteColor = { name: string; hex: string };

type ResultData = {
  styleName?: string;
  styleTag?: string;
  headline?: string;
  subcopy?: string;
  palette?: PaletteColor[];
};

function cx(...parts: Array<string | false | undefined | null>) {
  return parts.filter(Boolean).join(" ");
}

function safeJsonParse<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Best-effort: prova a leggere la palette salvata.
 * Se le tue key sono diverse, aggiungile qui.
 */
function readLastResultFromStorage(): ResultData | null {
  const KEYS = [
    "beo:lastPalette",
    "beo_last_palette",
    "beorganich:lastPalette",
    "beorganich_last_palette",
    "lastPalette",
    "lastResult",
    "beorganich:savedPalette", // ✅ includo anche quella che useremo nel salva
  ];

  for (const k of KEYS) {
    const raw = safeJsonParse<any>(
      typeof window !== "undefined" ? window.localStorage.getItem(k) : null
    );
    if (!raw) continue;

    const palette: PaletteColor[] | undefined =
      raw?.palette ??
      raw?.pal?.palette ??
      raw?.pal ??
      raw?.data?.palette ??
      raw?.result?.palette;

    if (Array.isArray(palette) && palette.length) {
      return {
        styleName: raw?.meta?.styleName ?? raw?.styleName ?? "SAGE STUDIO",
        styleTag: raw?.styleTag ?? "stile dominante",
        headline: raw?.headline ?? "Minimal moderno. Sempre coerente.",
        subcopy:
          raw?.subcopy ??
          "Colori puliti, look ordinati: scegli in un attimo e compra senza ripensamenti.",
        palette,
      };
    }
  }

  return null;
}

function buildVibeText(styleName?: string) {
  const vibe = styleName ? `La mia vibe: ${styleName} ✨` : "La mia vibe: Beorganich ✨";
  return (
    `${vibe}\n` +
    `Che vibe ti dà? Commenta 1 parola 👇\n` +
    `#beorganich #personalcolor #outfitcheck #capsulewardrobe #stylehack`
  );
}

export default function ResultClient() {
  // ✅ metti qui il link shop (provvisorio ok)
  const SHOP_URL = "https://beorganich.vercel.app/shop";

  const [data, setData] = useState<ResultData | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // email gate
  const [email, setEmail] = useState("");
  const [consentDrops, setConsentDrops] = useState(true);
  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  // --- Palette spotlight (premium)
const paletteScrollRef = useRef<HTMLDivElement | null>(null);
const [activeIdx, setActiveIdx] = useState(0);
const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => {
    const fromStorage = readLastResultFromStorage();

    // fallback demo
    const fallback: ResultData = {
      styleName: "SAGE STUDIO",
      styleTag: "stile dominante",
      headline: "Minimal moderno. Sempre coerente.",
      subcopy:
        "Colori che ti danno subito un’aria ordinata. Il tuo “uniform” di stile: pulito, sicuro, di livello.",
      palette: [
        { name: "Neutro Profondo", hex: "#2F2B28" },
        { name: "Base Pelle", hex: "#CBB2A3" },
        { name: "Caldo Soft", hex: "#C7A78F" },
        { name: "Verde Salvia", hex: "#9AA39A" },
        { name: "Blu Notte", hex: "#1C2430" },
        { name: "Avorio", hex: "#E7DFD5" },
      ],
    };

    setData(fromStorage ?? fallback);
  }, []);

  // auto-hide toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const palette = data?.palette ?? [];
  useEffect(() => {
  const el = paletteScrollRef.current;
  if (!el) return;

  const onScroll = () => {
    const cards = Array.from(el.querySelectorAll("[data-swatch-card]")) as HTMLElement[];
    if (!cards.length) return;

    const center = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;

    cards.forEach((card, i) => {
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const dist = Math.abs(cardCenter - center);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });

    setActiveIdx(best);
  };

  onScroll();
  el.addEventListener("scroll", onScroll, { passive: true });
  return () => el.removeEventListener("scroll", onScroll);
}, [palette.length]);

  // ProductsCarousel vuole PaletteItem[] => facciamo cast safe
  const paletteForCarousel = useMemo(() => {
    return palette.map((p) => ({ name: p.name, hex: p.hex })) as PaletteItem[];
  }, [palette]);

  const vibeText = useMemo(() => buildVibeText(data?.styleName), [data?.styleName]);

  const onSavePalette = async () => {
    try {
      const payload = {
        styleName: data?.styleName ?? null,
        styleTag: data?.styleTag ?? null,
        headline: data?.headline ?? null,
        subcopy: data?.subcopy ?? null,
        palette,
        savedAt: Date.now(),
      };

      window.localStorage.setItem("beorganich:savedPalette", JSON.stringify(payload));
      setToast("Palette salvata ✅");
    } catch {
      setToast("Errore 😕 Riprova.");
    }
  };

  const onSharePalette = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = vibeText;

    // 1) share sheet (mobile)
    try {
      if (navigator.share) {
        await navigator.share({ title: "La mia palette", text, url });
        setToast("Condivisa ✨");
        return;
      }
    } catch {
      return;
    }

    // 2) copia
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setToast("Copiato ✨ Incollalo su TikTok!");
    } catch {
      prompt("Copia e incolla:", `${text}\n${url}`);
    }
  };

  const scrollToPalette = () => {
    const el = document.getElementById("palette");
    if (!el) return;
    requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const onSubmitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();

    if (!isValidEmail(value)) {
      setEmailStatus("error");
      setToast("Inserisci un’email valida.");
      return;
    }

    setEmailStatus("sending");

    try {
      // 1) salva lead (se endpoint esiste)
      try {
        await fetch("/api/lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: value,
            consent_marketing: !!consentDrops,
            source: "result_page_drop_alert",
            palette,
            styleName: data?.styleName ?? null,
            url: typeof window !== "undefined" ? window.location.href : null,
          }),
        });
      } catch {
        // ignore
      }

      // 2) manda email (se /api/email è attivo)
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: value,
          styleName: data?.styleName ?? null,
          palette,
          url: typeof window !== "undefined" ? window.location.href : null,
          mode: "drop_alert",
        }),
      });

      if (!res.ok) throw new Error("EMAIL_SEND_FAILED");

      setEmailStatus("sent");
      setToast("Perfetto ✅ Drop alert attivato.");
    } catch {
      setEmailStatus("error");
      setToast("Errore invio 😕 Riprova.");
    }
  };

  return (
    <div className="min-h-dvh bg-black text-white">
      {/* NAV — no “RISULTATO”, Home a sinistra, Shop a destra */}
      <header className="mx-auto max-w-3xl px-4 pt-5">
        <div className="flex items-center justify-between">
          <div className="text-[12px] tracking-[0.28em] text-white/55">BEORGANICH</div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="rounded-full border border-white/15 bg-white/[0.03] px-4 py-2 text-[13px] text-white/80 hover:bg-white/[0.06] transition"
            >
              Home
            </Link>
            <Link
              href="/shop"
              className="rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-black hover:bg-white/90 transition"
            >
              Shop
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-28 pt-6">
        {/* HERO */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          {/* pills */}
          <div className="flex flex-wrap gap-2">
            <span className="select-none cursor-default rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-white/75">
              {data?.styleName ?? "SAGE STUDIO"}
            </span>
            <span className="select-none cursor-default rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-white/60">
              {data?.styleTag ?? "stile dominante"}
            </span>
          </div>

          <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight leading-[1.05]">
            {data?.headline ?? "Minimal moderno. Sempre coerente."}
          </h1>

          <p className="mt-3 text-[15px] leading-7 text-white/70">
            {data?.subcopy ??
              "Colori puliti, look ordinati: scegli in un attimo e compra senza ripensamenti."}
          </p>

          {/* Fashion authority close */}
          <div className="mt-6 text-center text-[14px] leading-6 text-white/80">
            <div className="font-medium">Questa palette è la tua firma.</div>
            <div className="text-white/55">Usala come riferimento, sempre.</div>
          </div>

          {/* ✅ CTA premium: porta alla palette (NON shop) */}
          <button
            type="button"
            onClick={scrollToPalette}
            className="group mt-5 flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[13px] text-white/80 hover:bg-white/[0.06] transition active:scale-[0.99]"
          >
            <span className="text-white/70">Vuoi affinare la palette?</span>
            <span className="font-semibold text-white/90">La tua firma è qui sotto</span>

            <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-black/30">
              <span className="absolute inset-0 rounded-full bg-white/5 blur-md opacity-0 group-hover:opacity-100 transition" />
              <span className="text-[16px] leading-none">↓</span>
            </span>
          </button>

          <div className="mt-4 flex flex-wrap gap-2 text-[12px] text-white/55">
            <span className="select-none cursor-default rounded-full border border-white/10 bg-white/[0.03] px-3 py-2">
              Palette personale
            </span>
            <span className="select-none cursor-default rounded-full border border-white/10 bg-white/[0.03] px-3 py-2">
              Match capi
            </span>
            <span className="select-none cursor-default rounded-full border border-white/10 bg-white/[0.03] px-3 py-2">
              Nessuna foto salvata
            </span>
          </div>
        </section>

        {/* PALETTE + SALVA/CONDIVIDI */}
        <section
          id="palette"
          className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 scroll-mt-24"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-semibold text-white/90">La tua palette</h2>
              <p className="mt-1 text-[12px] text-white/55">
                Se sei indeciso: scegli un colore qui dentro e vai sul sicuro.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* SALVA (sx) */}
              <button
                onClick={onSavePalette}
                className="relative z-10 inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-4 py-2 text-[13px] text-white/90 hover:bg-white/[0.08] hover:border-white/25 transition active:scale-[0.98]"
              >
                Salva
                <span className="inline-block h-[6px] w-[6px] rounded-full bg-white/60" />
              </button>

              {/* CONDIVIDI (dx) */}
              <button
                onClick={onSharePalette}
                className="relative z-10 inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-black hover:bg-white/90 transition active:scale-[0.98] shadow-[0_10px_34px_rgba(255,255,255,0.12)]"
              >
                Condividi ✨
              </button>
            </div>
          </div>

          {/* PALETTE SPOTLIGHT (premium) */}
<div className="mt-5 rounded-3xl border border-white/10 bg-black/20 overflow-hidden">
  {/* top row */}
  <div className="flex items-center justify-between px-4 pt-4">
    <div className="text-[12px] tracking-[0.22em] text-white/55 uppercase">
      Palette spotlight
    </div>

    <button
      type="button"
      onClick={() => setPaletteOpen(true)}
      className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-2 text-[12px] text-white/75 hover:bg-white/[0.06] transition active:scale-[0.99]"
    >
      Espandi
    </button>
  </div>

  <div className="px-4 -mt-1 pb-2 text-[12px] text-white/45">
    Scorri → per vedere tutta la palette
  </div>

  {/* edge fades */}
  <div className="relative">
    <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-black/60 to-transparent z-10" />
    <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-black/60 to-transparent z-10" />

    {/* scroll area */}
    <div
      ref={paletteScrollRef}
      className="mt-1 flex gap-4 overflow-x-auto px-4 pb-4 no-scrollbar snap-x snap-mandatory"
    >
      {palette.map((c, i) => (
        <button
          key={`${c.name}-${c.hex}`}
          data-swatch-card
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="
            snap-center shrink-0 w-[78%] sm:w-[420px]
            rounded-3xl border border-white/10 bg-white/[0.03]
            p-4 text-left transition active:scale-[0.99]
            hover:bg-white/[0.05]
          "
        >
          <div className="flex items-center gap-4">
            {/* big swatch */}
            <div className="relative">
              <div
                className="h-16 w-16 rounded-3xl border border-white/10"
                style={{ background: c.hex }}
              />
              <div
                className="absolute -inset-4 rounded-[28px] opacity-30 blur-2xl"
                style={{ background: c.hex }}
                aria-hidden
              />
            </div>

            <div className="min-w-0">
              <div className="text-[16px] font-semibold text-white/90 truncate">
                {c.name}
              </div>
              <div className="mt-1 text-[12px] text-white/55 font-mono">
                {c.hex}
              </div>

              <div className="mt-2 text-[12px] leading-5 text-white/60">
                {i === 0
                  ? "Base forte: ti fa sembrare subito più ordinato."
                  : "Usalo nei capi principali per un look coerente."}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  </div>

  {/* dots */}
  <div className="flex items-center justify-center gap-2 pb-4">
    {palette.map((_, i) => (
      <div
        key={i}
        className={
          i === activeIdx
            ? "h-[7px] w-[7px] rounded-full bg-white/70 border border-white/20"
            : "h-[7px] w-[7px] rounded-full bg-white/10 border border-white/15"
        }
      />
    ))}
  </div>
</div>

          {/* vibe box */}
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="text-[12px] text-white/70">
              <span className="text-white/90 font-medium">Vibe pronta per TikTok:</span>
            </div>
            <div className="mt-2 whitespace-pre-line text-[12px] leading-6 text-white/55">{vibeText}</div>
            <div className="mt-2 text-[12px] text-white/45">
              Tip: screenshot palette → post → “che vibe ti dà?” → commenti = algoritmo 🔥
            </div>
          </div>

          {/* ✅ Link “rifai scan” qui (opportunità, ma NON shop) */}
          <div className="mt-4 text-center">
            <Link
              href="/scan"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-4 py-2 text-[12px] text-white/70 hover:bg-white/[0.06] hover:text-white/85 transition"
            >
              Vuoi una lettura più precisa? Rifai lo scan <span className="text-white/60">→</span>
            </Link>
          </div>
        </section>

        {/* ✅ PRODUCT CAROUSEL (match capi cliccabili) */}
        <section className="mt-5">
          <div className="flex items-end justify-between gap-3 px-1">
            <div>
              <div className="text-[16px] font-semibold text-white/90">Capi consigliati</div>
              <div className="mt-1 text-[12px] text-white/55">
                Selezionati per la tua palette. Clicca un capo per aprirlo.
              </div>
            </div>

            <Link
              href="/shop"
              className="text-[12px] text-white/70 underline underline-offset-4 hover:text-white/90 transition"
            >
              Vai allo shop →
            </Link>
          </div>

          <div className="mt-3">
            <ProductsCarousel palette={paletteForCarousel} shopUrl={SHOP_URL} />
          </div>
        </section>

        {/* EMAIL = SALVA + DROP ALERT */}
        <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <div className="text-[16px] font-semibold text-white/90">Salva la palette + Drop alert</div>
          <div className="mt-1 text-[12px] text-white/55">
            Ti inviamo la palette e ti avvisiamo quando escono capi perfetti per te.
          </div>

          <form onSubmit={onSubmitEmail} className="mt-4 grid gap-3">
            <input
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailStatus !== "idle") setEmailStatus("idle");
              }}
              placeholder="la-tua-email@email.com"
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-[14px] text-white/90 outline-none focus:border-white/25"
              inputMode="email"
              autoComplete="email"
            />

            <label className="flex items-center gap-2 text-[12px] text-white/60 select-none">
              <input
                type="checkbox"
                checked={consentDrops}
                onChange={(e) => setConsentDrops(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-black/30"
              />
              Voglio essere avvisato dei drop compatibili con la mia palette
            </label>

            <button
              type="submit"
              disabled={emailStatus === "sending"}
              className={cx(
                "relative z-10 h-12 w-full rounded-2xl bg-white text-black text-[14px] font-semibold transition active:scale-[0.99]",
                emailStatus === "sending" && "opacity-70 cursor-not-allowed"
              )}
            >
              {emailStatus === "sending"
                ? "Attivo..."
                : emailStatus === "sent"
                ? "Attivato ✅"
                : "Attiva Drop Alert"}
            </button>

            {emailStatus === "error" && (
              <div className="text-[12px] text-rose-200/80">Email non valida o errore invio. Riprova.</div>
            )}

            <div className="text-[12px] text-white/45">Niente spam. Solo drop coerenti con la tua palette.</div>
          </form>
        </section>
      </main>
{/* PALETTE SHEET */}
{paletteOpen && (
  <div className="fixed inset-0 z-[80]">
    {/* backdrop */}
    <button
      type="button"
      onClick={() => setPaletteOpen(false)}
      className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      aria-label="Chiudi"
    />

    {/* sheet */}
    <div className="absolute left-0 right-0 bottom-0 mx-auto max-w-3xl">
      <div className="rounded-t-3xl border border-white/10 bg-[#0b0b0b] shadow-[0_-30px_80px_rgba(0,0,0,0.75)]">
        <div className="flex items-center justify-between px-5 pt-4">
          <div>
            <div className="text-[14px] font-semibold text-white/90">La tua palette</div>
            <div className="mt-1 text-[12px] text-white/55">
              Screenshot + usa come riferimento quando compri.
            </div>
          </div>

          <button
            type="button"
            onClick={() => setPaletteOpen(false)}
            className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-2 text-[12px] text-white/70 hover:bg-white/[0.06] transition"
          >
            Chiudi
          </button>
        </div>

        <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {palette.map((c) => (
              <div
                key={`${c.name}-${c.hex}-sheet`}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex items-center gap-4"
              >
                <div
                  className="h-14 w-14 rounded-2xl border border-white/10"
                  style={{ background: c.hex }}
                />
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-white/90 truncate">{c.name}</div>
                  <div className="text-[12px] text-white/55 font-mono">{c.hex}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-2">
            <button
              type="button"
              onClick={onSavePalette}
              className="h-12 w-full rounded-2xl border border-white/15 bg-white/[0.03] text-[14px] text-white/90 hover:bg-white/[0.06] transition active:scale-[0.99]"
            >
              Salva palette
            </button>
            <button
              type="button"
              onClick={onSharePalette}
              className="h-12 w-full rounded-2xl bg-white text-black text-[14px] font-semibold hover:bg-white/90 transition active:scale-[0.99]"
            >
              Condividi ✨
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
)}
      {/* TOAST */}
      {toast && (
        <div className="fixed left-1/2 top-5 z-[60] -translate-x-1/2">
          <div className="rounded-full border border-white/15 bg-black/70 px-4 py-2 text-[12px] text-white/85 backdrop-blur">
            {toast}
          </div>
        </div>
      )}

      {/* ✅ STICKY CTA mobile = UNICO SHOP CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden pointer-events-none px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3 bg-gradient-to-t from-black/90 to-transparent">
        <div className="mx-auto max-w-3xl pointer-events-auto">
          <Link
            href="/shop"
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-white text-black text-[15px] font-semibold active:scale-[0.99] transition shadow-[0_12px_36px_rgba(255,255,255,0.18)]"
          >
            Vai allo shop →
          </Link>
          <div className="mt-2 text-center text-[12px] text-white/60">Palette pronta · Match già selezionati</div>
        </div>
      </div>
    </div>
  );
}

/*
Se non hai la classe no-scrollbar, aggiungi in globals.css:

.no-scrollbar::-webkit-scrollbar { display:none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
*/
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import Link from "next/link";
import ConfidencePill from "@/app/components/ConfidencePill";

// ✅ usa il tuo componente
import ProductsCarousel from "@/app/components/ProductsCarousel";
import type { PaletteItem } from "@/app/lib/paletteLogic";

type PaletteColor = { name: string; hex: string; style?: string };

type ResultData = {
  styleName?: string;
  styleTag?: string;
  headline?: string;
  subcopy?: string;
  palette?: PaletteColor[];
  meta?: {
    confidence?: number;
    quality?: number;
    method?: "camera" | "upload";
    sampleCount?: number;
  };
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
    "beorganich:lastPalette:v1",
    "beo:lastPalette",
    "beo_last_palette",
    "beorganich:lastPalette",
    "beorganich_last_palette",
    "lastPalette",
    "lastResult",
    "beorganich:savedPalette",
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
      const styleMap: Record<string, string> = {
  "NOIR ICON": "ICON NOIR",
  "SAND LUXE": "SAND LUXE",
  "SAGE MODERN": "SAGE STUDIO",
  "ICE ROYAL": "ICE ROYAL",
};

const inferredStyle =
  raw?.meta?.styleName ??
  raw?.styleName ??
  (Array.isArray(palette) ? styleMap[(palette[0] as any)?.style ?? ""] : undefined);
      return {
  styleName: raw?.styleName ?? raw?.meta?.styleName ?? "SAGE STUDIO",
  styleTag: raw?.styleTag ?? "stile dominante",
  headline: raw?.headline ?? "Minimal moderno. Sempre coerente.",
  subcopy: raw?.subcopy ?? "Colori puliti, look ordinati...",
  palette,
  meta: raw?.meta,
};
    }
  }

  return null;
}

function buildVibeText(styleName?: string) {
  const vibe = styleName ? `La mia vibe: ${styleName} ✨` : "La mia vibe ✨";
  return (
    `${vibe}\n` +
    `Che vibe ti dà? Commenta 1 parola 👇\n` +
    `#personalcolor #outfitcheck #capsulewardrobe #stylehack`
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

  // --- Sheet
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const fromStorage = readLastResultFromStorage();
    const KEYS = [
  "beorganich:lastPalette:v1",
  "beorganich:savedPalette",
  "beorganich:lastPalette",
  "lastResult",
  "lastPalette",
];

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
const onSavePaletteToGallery = async () => {
  try {
    if (!palette?.length) {
      setToast("Palette vuota 😕");
      return;
    }

    // Canvas hi-res
    const W = 1200;
    const P = 72;
    const cardH = 160;
    const gap = 18;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("NO_CTX");

    const H = P * 2 + 220 + palette.length * (cardH + gap);
    canvas.width = W;
    canvas.height = H;

    // Background
    ctx.fillStyle = "#0b0b0b";
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "700 54px system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillText(data?.styleName ?? "La tua palette", P, P + 60);

    // Subtitle
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "400 28px system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillText("UNYFORM · personal color", P, P + 112);

    // Cards
    let y = P + 160;
    palette.forEach((c) => {
      // card
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      roundRect(ctx, P, y, W - P * 2, cardH, 28);
      ctx.fill();

      // swatch
      ctx.fillStyle = c.hex;
      roundRect(ctx, P + 22, y + 22, 116, 116, 26);
      ctx.fill();

      // text
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "700 34px system-ui, -apple-system, Segoe UI, Roboto";
      ctx.fillText(c.name, P + 160, y + 70);

      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "500 26px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas";
      ctx.fillText(c.hex.toUpperCase(), P + 160, y + 110);

      y += cardH + gap;
    });

    // Make file
    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("NO_BLOB"))), "image/png", 1);
    });

    const file = new File([blob], "unyform-palette.png", { type: "image/png" });

    // ✅ Best: Share sheet -> Save to Photos/Gallery
    const canShareFiles =
      typeof navigator !== "undefined" &&
      "canShare" in navigator &&
      (navigator as any).canShare({ files: [file] });

    if (canShareFiles && "share" in navigator) {
      await (navigator as any).share({
        files: [file],
        title: "Palette UNYFORM",
        text: "Salva la tua palette",
      });
      setToast("Apri Condividi → Salva immagine ✅");
      return;
    }

    // Fallback: download (poi “Salva in Foto” da file su iOS/Android)
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "unyform-palette.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    setToast("Scaricata ✅ Apri file e salva in Foto");
  } catch {
    setToast("Errore salvataggio 😕");
  }
};

// helper per bordi arrotondati
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
  // active dot logic
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

  // lock body scroll when sheet open (iOS fix)
  useEffect(() => {
    if (!paletteOpen) return;

    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = (document.body.style as any).touchAction;

    document.body.style.overflow = "hidden";
    (document.body.style as any).touchAction = "none";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPaletteOpen(false);
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      (document.body.style as any).touchAction = prevTouchAction;
    };
  }, [paletteOpen]);

  // ProductsCarousel vuole PaletteItem[] => cast safe
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
    {/* NAV — Home premium (Results) */}
<header className="mx-auto max-w-3xl px-4 pt-4">
  <div className="flex justify-end">
    <Link
      href="/"
      className="
        group inline-flex items-center gap-2
        rounded-full border border-white/15
        bg-white/[0.02]
        px-4 py-2
        text-[13px] font-medium text-white/75
        backdrop-blur
        transition-all duration-300
        hover:bg-white/[0.06]
        hover:text-white
        active:scale-[0.97]
      "
    >
      <span
        className="
          flex h-6 w-6 items-center justify-center
          rounded-full border border-white/15
          text-[14px] leading-none
          transition group-hover:border-white/30
        "
      >
        ←
      </span>

      Home
    </Link>
  </div>
</header>

      <main className="mx-auto max-w-3xl px-4 pb-28 pt-6">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-7">
  {/* soft highlight */}
  <div
    aria-hidden
    className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-white/[0.06] blur-3xl"
  />
  <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_220px_at_50%_-40px,rgba(255,255,255,0.10),transparent_60%)]" />

  {/* pills */}
  <div className="flex flex-wrap items-center gap-2">
    <span className="select-none cursor-default rounded-full border border-white/12 bg-black/30 px-3 py-2 text-[12px] text-white/80 backdrop-blur">
      {data?.styleName ?? "SAGE STUDIO"}
    </span>
    <span className="select-none cursor-default rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-white/55">
      {data?.styleTag ?? "stile dominante"}
    </span>

    {/* confidence as badge (integrato) */}
    {data?.meta?.confidence != null && (
      <span className="ml-auto select-none cursor-default rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-white/65">
        Accuracy <span className="tabular-nums text-white/85">{data.meta.confidence}%</span>
      </span>
    )}
  </div>

  <h1 className="mt-5 text-balance text-[38px] sm:text-[44px] font-semibold tracking-[-0.02em] leading-[1.04]">
    {data?.headline ?? "Minimal moderno. Sempre coerente."}
  </h1>

  <p className="mt-3 max-w-[52ch] text-[15px] leading-7 text-white/70">
    {data?.subcopy ??
      "Colori puliti, look ordinati: scegli in un attimo e compra senza ripensamenti."}
  </p>

  {/* micro-value */}
  <div className="mt-5 grid grid-cols-3 gap-2">
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-3">
      <div className="text-[11px] tracking-[0.18em] text-white/45 uppercase">Palette</div>
      <div className="mt-1 text-[12px] text-white/80">personale</div>
    </div>
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-3">
      <div className="text-[11px] tracking-[0.18em] text-white/45 uppercase">Match</div>
      <div className="mt-1 text-[12px] text-white/80">capi</div>
    </div>
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-3">
      <div className="text-[11px] tracking-[0.18em] text-white/45 uppercase">Privacy</div>
      <div className="mt-1 text-[12px] text-white/80">on-device</div>
    </div>
  </div>

  {/* CTA row */}
  <div className="mt-6 flex flex-col sm:flex-row gap-2">
    <div className="mt-6 text-[12px] uppercase tracking-[0.18em] text-white/40">
  Personal palette
</div>

    <button className="mt-4 text-[14px] text-white/60 underline underline-offset-4">
  Rifai lo scan
</button>
  </div>

  <div className="mt-4 text-center text-[12px] text-white/45">
    Tip: salva la palette e usala come “uniform” quando compri.
  </div>
</section>

        {/* PALETTE */}
        <section
          id="palette-export"
          className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 scroll-mt-24"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-semibold text-white/90">La tua palette</h2>
              <p className="mt-1 text-[12px] text-white/55">
                Se sei indeciso: scegli un colore qui dentro e vai sul sicuro.
              </p>
            </div>
{/* ULTRA LUXURY PALETTE GRID */}
<div className="mt-5 rounded-3xl border border-white/10 bg-black/30 p-4 sm:p-5 overflow-hidden">
  {/* top micro-header */}
  <div className="flex items-center justify-between">
    <div className="text-[12px] uppercase tracking-[0.22em] text-white/45">
      Palette personale
    </div>

    <button
      type="button"
      onClick={() => {
        try {
          const text = palette.map((c) => `${c.name} ${c.hex.toUpperCase()}`).join(" • ");
          navigator.clipboard?.writeText(text);
          setToast("Palette copiata ✅");
        } catch {
          setToast("Impossibile copiare 😕");
        }
      }}
      className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-2 text-[12px] text-white/70 hover:bg-white/[0.06] transition active:scale-[0.99]"
    >
      Copia palette
    </button>
  </div>

  <div className="mt-2 text-[12px] text-white/45">
    Tocca un colore per copiare l’HEX.
  </div>

  {/* grid */}
  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
    {palette.map((c, i) => (
      <button
        key={`${c.name}-${c.hex}-${i}`}
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(c.hex.toUpperCase());
            setToast(`${c.hex.toUpperCase()} copiato ✅`);
          } catch {
            setToast("Copia non supportata 😕");
          }
        }}
        className="
          group relative overflow-hidden rounded-3xl
          border border-white/10 bg-white/[0.03]
          text-left transition
          hover:bg-white/[0.06] hover:border-white/20
          active:scale-[0.99]
        "
      >
        {/* soft glow */}
        <div
          className="pointer-events-none absolute -inset-10 opacity-20 blur-2xl"
          style={{ background: c.hex }}
          aria-hidden
        />

        <div className="relative p-3">
          {/* swatch */}
          <div className="relative">
            <div
              className="h-[92px] w-full rounded-2xl border border-white/10"
              style={{ background: c.hex }}
            />
            <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]" />

            {/* micro-chip */}
            <div className="absolute left-2 top-2 inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/45 px-2 py-1 backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-white/70" />
              <span className="text-[11px] text-white/80">
                {i === 0 ? "Anchor" : i === 1 ? "Core" : i === 2 ? "Lift" : "Accent"}
              </span>
            </div>
          </div>

          {/* text */}
          <div className="mt-3">
            <div className="text-[15px] font-semibold text-white/90 truncate">
              {c.name}
            </div>

            <div className="mt-1 flex items-center justify-between">
              <div className="text-[12px] font-mono text-white/55">
                {c.hex.toUpperCase()}
              </div>

              <div className="text-[12px] text-white/45 opacity-0 translate-y-[2px] group-hover:opacity-100 group-hover:translate-y-0 transition">
                Copia →
              </div>
            </div>

            <div className="mt-2 text-[12px] leading-5 text-white/55">
              {i === 0
                ? "Base forte: capi principali."
                : i === 1
                ? "Routine: facile da abbinare."
                : i === 2
                ? "Illumina: perfetto per top."
                : "Dettaglio: alza il livello."}
            </div>
          </div>
        </div>
      </button>
    ))}
  </div>

  {/* premium footnote */}
  <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-[12px] text-white/55">
    Regola luxury: scegli <span className="text-white/80 font-medium">1 colore</span> e costruisci l’outfit attorno. Zero caos.
  </div>
</div>
            <div className="flex items-center gap-2">
              <button
                onClick={onSavePaletteToGallery}
                className="relative z-10 inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-4 py-2 text-[13px] text-white/90 hover:bg-white/[0.08] hover:border-white/25 transition active:scale-[0.98]"
              >
                Salva
                <span className="inline-block h-[6px] w-[6px] rounded-full bg-white/60" />
              </button>

              <button
                onClick={onSharePalette}
                className="relative z-10 inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-black hover:bg-white/90 transition active:scale-[0.98] shadow-[0_10px_34px_rgba(255,255,255,0.12)]"
              >
                Condividi ✨
              </button>
            </div>
          </div>
          {/* vibe box */}
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
  <div className="flex items-start justify-between gap-3">
    <div>
      <div className="text-[12px] tracking-[0.22em] text-white/45 uppercase">Share</div>
      <div className="mt-1 text-[13px] text-white/80 font-medium">Caption pronta per TikTok</div>
    </div>
    <button
      type="button"
      onClick={onSharePalette}
      className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-2 text-[12px] text-white/75 hover:bg-white/[0.06] transition active:scale-[0.99]"
    >
      Copia
    </button>
  </div>

  <div className="mt-3 whitespace-pre-line rounded-xl border border-white/10 bg-black/30 p-3 text-[12px] leading-6 text-white/55">
    {vibeText}
  </div>

  <div className="mt-2 text-[12px] text-white/40">
    Tip: screenshot palette → post → “che vibe ti dà?” → commenti = algoritmo.
  </div>
</div>

          <div className="mt-4 text-center">
            <Link
              href="/scan"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-4 py-2 text-[12px] text-white/70 hover:bg-white/[0.06] hover:text-white/85 transition"
            >
              Vuoi una lettura più precisa? Rifai lo scan <span className="text-white/60">→</span>
            </Link>
          </div>
        </section>

        {/* PRODUCTS */}
        <section className="mt-5">
          
          <div className="mt-3">
            <ProductsCarousel palette={paletteForCarousel} shopUrl={SHOP_URL} />
          </div>
        </section>

        {/* EMAIL */}
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

      {/* ✅ PALETTE SHEET (FIX: chiudi + non taglia + torna indietro centrato) */}
      {paletteOpen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center px-3">
          {/* backdrop (tap fuori chiude) */}
          <button
            type="button"
            onClick={() => setPaletteOpen(false)}
            className="absolute inset-0 z-0 bg-black/60 backdrop-blur-sm"
            aria-label="Chiudi"
          />

          {/* sheet */}
          <div className="relative z-10 w-full max-w-3xl">
            <div className="w-full rounded-t-3xl border border-white/10 bg-[#0b0b0b] shadow-[0_-30px_80px_rgba(0,0,0,0.75)] overflow-hidden">
              {/* handle iOS */}
              <div className="flex justify-center pt-2">
                <div className="h-1.5 w-12 rounded-full bg-white/15" />
              </div>

              {/* header sticky */}
              <div className="sticky top-0 z-10 bg-[#0b0b0b]/95 backdrop-blur border-b border-white/10 px-5 py-4">
                <div className="text-center">
                  <div className="text-[14px] font-semibold text-white/90">La tua palette</div>
                  <div className="mt-1 text-[12px] text-white/55">
                    Screenshot + usa come riferimento quando compri.
                  </div>
                </div>

                <div className="mt-3 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setPaletteOpen(false)}
                    className="w-full max-w-[260px] h-11 rounded-2xl border border-white/15 bg-white/[0.03] text-[14px] text-white/85 hover:bg-white/[0.06] transition active:scale-[0.99]"
                  >
                    Torna indietro
                  </button>
                </div>
              </div>

              {/* content scroll (NO taglio) */}
              <div className="px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+18px)] max-h-[70vh] overflow-y-auto">
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
                    className="relative z-10 inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-black/30 px-4 py-2 text-[13px] text-white/90 backdrop-blur transition hover:bg-white/[0.08] hover:border-white/25 active:scale-[0.98]"
                  >
                    Salva <span className="text-white/60">↧</span>
                  </button>
                  <button
                    type="button"
                    onClick={onSharePalette}
                    className="h-12 w-full rounded-2xl bg-white text-black text-[14px] font-semibold hover:bg-white/90 transition active:scale-[0.99]"
                  >
                    Condividi ✨
                  </button>
                </div>

                <div className="mt-3 text-center text-[12px] text-white/40">
                  Tip: su iPhone puoi chiudere anche tappando fuori.
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

      {/* STICKY CTA mobile = UNICO SHOP CTA */}
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
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type PaletteColor = { name: string; hex: string };
type ResultData = {
  styleName?: string;         // es: "SAGE STUDIO"
  styleTag?: string;          // es: "stile dominante"
  headline?: string;          // es: "Minimal moderno. Coerenza immediata."
  subcopy?: string;           // es: "Outfit puliti, zero sbatti..."
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

/**
 * Best-effort: prova a leggere la palette salvata da localStorage.
 * (Nel tuo progetto hai già saveLastPalette(pal, meta); qui leggiamo il possibile salvataggio.)
 * Se i tuoi key sono diversi, aggiungili in KEYS.
 */
function readLastResultFromStorage(): ResultData | null {
  const KEYS = [
    "beo:lastPalette",
    "beo_last_palette",
    "beorganich:lastPalette",
    "beorganich_last_palette",
    "lastPalette",
    "lastResult",
  ];

  for (const k of KEYS) {
    const raw = safeJsonParse<any>(typeof window !== "undefined" ? window.localStorage.getItem(k) : null);
    if (!raw) continue;

    // supporta formati diversi: { pal, meta } oppure { palette } ecc.
    const palette: PaletteColor[] | undefined =
      raw?.palette ??
      raw?.pal?.palette ??
      raw?.pal ??
      raw?.data?.palette ??
      raw?.result?.palette;

    if (Array.isArray(palette) && palette.length) {
      return {
        styleName: raw?.meta?.styleName ?? raw?.styleName ?? "SAGE STUDIO",
        styleTag: raw?.meta?.depth ?? raw?.styleTag ?? "stile dominante",
        headline: raw?.headline ?? "Minimal moderno. Coerenza immediata.",
        subcopy:
          raw?.subcopy ??
          "Colori puliti, look ordinati: scegli in un attimo e compra senza ripensamenti.",
        palette,
      };
    }
  }

  return null;
}

export default function ResultClient() {
  const [data, setData] = useState<ResultData | null>(null);

  // email form
  const [email, setEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  // caricamento result
  useEffect(() => {
    const fromStorage = readLastResultFromStorage();

    // fallback demo se non trova nulla
    const fallback: ResultData = {
      styleName: "SAGE STUDIO",
      styleTag: "stile dominante",
      headline: "Minimal moderno. Coerenza immediata.",
      subcopy:
        "Colori che puliscono la palette e ti danno subito un’aria ordinata. Il tuo “uniform” di stile.",
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

  const palette = data?.palette ?? [];

  // Testo trend TikTok
  const shareText = useMemo(() => {
    const main = data?.styleName ? `La mia vibe: ${data.styleName} ✨` : "La mia palette Beorganich ✨";
    return (
      `${main}\n` +
      `Che vibe ti dà? 👀\n` +
      `#beorganich #personalcolor #outfitcheck #styleguide`
    );
  }, [data?.styleName]);

  const onSharePalette = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = shareText;

    // 1) share sheet (mobile)
    try {
      if (navigator.share) {
        await navigator.share({ title: "La mia palette", text, url });
        return;
      }
    } catch {
      // user ha chiuso: ok
      return;
    }

    // 2) copia appunti
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      alert("Copiato ✨ Incollalo su TikTok/Instagram!");
    } catch {
      // 3) ultimo fallback
      prompt("Copia e incolla:", `${text}\n${url}`);
    }
  };

  /**
   * INVIO EMAIL
   * Nota: qui faccio POST a /api/email.
   * Se il tuo endpoint si chiama diverso, cambia SOLO l'URL.
   * Body contiene email + palette + styleName.
   */
  const onSubmitEmail = async (e: React.FormEvent) => {
    e.preventDefault();

    const value = email.trim();
    if (!value || !value.includes("@")) {
      setEmailStatus("error");
      return;
    }

    setEmailStatus("sending");

    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: value,
          styleName: data?.styleName ?? null,
          palette,
          url: typeof window !== "undefined" ? window.location.href : null,
        }),
      });

      if (!res.ok) throw new Error("EMAIL_SEND_FAILED");
      setEmailStatus("sent");
    } catch {
      setEmailStatus("error");
    }
  };

  return (
    <div className="min-h-dvh bg-black text-white">
      {/* NAV (NO “RISULTATO”) — Home a sinistra, Shop a destra */}
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
        {/* HERO CARD */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          {/* tagline pills (pulite, NON cliccabili) */}
          <div className="flex flex-wrap gap-2">
            <span className="select-none cursor-default rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-white/75">
              {data?.styleName ?? "SAGE STUDIO"}
            </span>
            <span className="select-none cursor-default rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-white/60">
              {data?.styleTag ?? "stile dominante"}
            </span>
          </div>

          <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight leading-[1.05]">
            {data?.headline ?? "Minimal moderno. Coerenza immediata."}
          </h1>

          <p className="mt-3 text-[15px] leading-7 text-white/70">
            {data?.subcopy ??
              "Colori puliti, look ordinati: scegli in un attimo e compra senza ripensamenti."}
          </p>

          {/* CTA (NO ripetizioni) */}
          <div className="mt-5 flex gap-3">
            <Link
              href="/shop"
              className="relative z-10 flex h-14 flex-1 items-center justify-center rounded-2xl bg-white text-black text-[15px] font-semibold hover:bg-white/90 transition active:scale-[0.99]"
            >
              Vai allo shop →
            </Link>

            <Link
              href="/scan"
              className="relative z-10 flex h-14 w-[42%] items-center justify-center rounded-2xl border border-white/15 bg-white/[0.02] text-white/85 hover:bg-white/[0.06] transition active:scale-[0.99]"
            >
              Rifai scan
            </Link>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-[12px] text-white/55">
            <span className="select-none cursor-default rounded-full border border-white/10 bg-white/[0.03] px-3 py-2">
              Palette personale
            </span>
            <span className="select-none cursor-default rounded-full border border-white/10 bg-white/[0.03] px-3 py-2">
              Capi coerenti
            </span>
            <span className="select-none cursor-default rounded-full border border-white/10 bg-white/[0.03] px-3 py-2">
              Nessuna foto salvata
            </span>
          </div>
        </section>

        {/* PALETTE CARD (qui mettiamo il “Condividi” trend TikTok) */}
        <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-semibold text-white/90">La tua palette personale</h2>
              <p className="mt-1 text-[12px] text-white/55">
                Se sei indeciso: scegli un colore qui dentro e vai sul sicuro.
              </p>
            </div>

            <button
              onClick={onSharePalette}
              className="relative z-10 rounded-full border border-white/15 bg-white/[0.03] px-4 py-2 text-[13px] text-white/85 hover:bg-white/[0.06] transition active:scale-[0.98]"
            >
              Condividi
            </button>
          </div>

          {/* Marquee / palette row (se tu già usi marquee CSS, puoi mantenerlo) */}
          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
            <div className="flex gap-3 p-4 overflow-x-auto no-scrollbar">
              {palette.map((c) => (
                <div
                  key={c.hex}
                  className="min-w-[210px] flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3"
                >
                  <div className="relative">
                    <div
                      className="h-12 w-12 rounded-2xl border border-white/10"
                      style={{ background: c.hex }}
                    />
                    <div
                      className="absolute -inset-2 rounded-[18px] opacity-30 blur-lg"
                      style={{ background: c.hex }}
                      aria-hidden
                    />
                  </div>

                  <div className="flex flex-col">
                    <div className="text-[13px] font-semibold text-white/90">{c.name}</div>
                    <div className="text-[12px] text-white/55 font-mono">{c.hex}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* TikTok tip */}
          <div className="mt-3 text-[12px] text-white/45">
            Tip TikTok: fai screenshot della palette e scrivi “che vibe ti dà?” 👀{" "}
            <span className="text-white/70">#outfitcheck</span>
          </div>
        </section>

        {/* EMAIL GATE (fix click) */}
        <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <div className="text-[16px] font-semibold text-white/90">Invia il risultato via email</div>
          <div className="mt-1 text-[12px] text-white/55">
            Ti mandiamo la palette e un link rapido allo shop. (Niente spam)
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

            <button
              type="submit"
              disabled={emailStatus === "sending"}
              className={cx(
                "relative z-10 h-12 w-full rounded-2xl bg-white text-black text-[14px] font-semibold transition active:scale-[0.99]",
                emailStatus === "sending" && "opacity-70 cursor-not-allowed"
              )}
            >
              {emailStatus === "sending" ? "Invio..." : emailStatus === "sent" ? "Inviata ✅" : "Invia email"}
            </button>

            {emailStatus === "error" && (
              <div className="text-[12px] text-rose-200/80">
                Email non valida o errore di invio. Riprova.
              </div>
            )}
          </form>
        </section>
      </main>

      {/* STICKY CTA mobile (non deve bloccare i click sopra!) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden pointer-events-none px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3 bg-gradient-to-t from-black/90 to-transparent">
        <div className="mx-auto max-w-3xl pointer-events-auto">
          <Link
            href="/shop"
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-white text-black text-[15px] font-semibold active:scale-[0.99] transition shadow-[0_12px_36px_rgba(255,255,255,0.18)]"
          >
            Vai allo shop →
          </Link>
          <div className="mt-2 text-center text-[12px] text-white/60">
            Palette pronta · Nessuna foto salvata
          </div>
        </div>
      </div>
    </div>
  );
}

/* opzionale: se non hai la classe no-scrollbar, puoi aggiungere in globals:
.no-scrollbar::-webkit-scrollbar { display:none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
*/
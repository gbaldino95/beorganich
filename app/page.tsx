"use client";

import React, { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import StatusPill from "./components/StatusPill";
import HomeLogo from "@/app/components/HomeLogo";

type CamStatus = "idle" | "checking" | "ready" | "locked";

export default function HomePage() {
  const [cameraStatus, setCameraStatus] = useState<CamStatus>("checking");
  const [pulseReady, setPulseReady] = useState(false);

  // --- Tilt (desktop only)
  const tiltRef = useRef<HTMLDivElement | null>(null);
  const [tiltStyle, setTiltStyle] = useState<CSSProperties>({});
  const [tiltEnabled, setTiltEnabled] = useState(false);

  useEffect(() => {
    const mm = window.matchMedia?.("(pointer:fine)");
    const rm = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    setTiltEnabled(!!mm?.matches && !rm?.matches);
  }, []);

  useEffect(() => {
    if (!tiltEnabled) return;
    const el = tiltRef.current;
    if (!el) return;

    let raf: number | null = null;

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      const rx = (0.5 - y) * 4.5;
      const ry = (x - 0.5) * 6.5;

      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setTiltStyle({
          transform: `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-2px)`,
        });
      });
    };

    const onLeave = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setTiltStyle({
          transform: "perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0px)",
        });
      });
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [tiltEnabled]);

  // --- Camera status (does NOT ask for permission)
  useEffect(() => {
    let alive = true;

    async function checkCamera() {
      try {
        if (!navigator?.mediaDevices?.getUserMedia) {
          if (!alive) return;
          setCameraStatus("locked");
          return;
        }

        if ("permissions" in navigator && (navigator as any).permissions?.query) {
          try {
            const res = await (navigator as any).permissions.query({ name: "camera" });
            if (!alive) return;

            if (res.state === "granted") {
              setCameraStatus("ready");
              setPulseReady(true);
              setTimeout(() => setPulseReady(false), 1100);
              return;
            }
            if (res.state === "denied") {
              setCameraStatus("locked");
              return;
            }
            setCameraStatus("idle");
            return;
          } catch {
            // ignore
          }
        }

        if (!alive) return;
        setCameraStatus("idle");
      } catch {
        if (!alive) return;
        setCameraStatus("idle");
      }
    }

    checkCamera();
    return () => {
      alive = false;
    };
  }, []);

  // --- Palette preview (marquee)
  const previewPalette = useMemo(
    () => [
      { name: "Neutro Profondo", hex: "#2F2B28" },
      { name: "Base Pelle", hex: "#CBB2A3" },
      { name: "Caldo Soft", hex: "#C7A78F" },
      { name: "Verde Salvia", hex: "#9AA39A" },
      { name: "Blu Notte", hex: "#1C2430" },
      { name: "Avorio", hex: "#E7DFD5" },
    ],
    []
  );

  const marquee = useMemo(() => [...previewPalette, ...previewPalette], [previewPalette]);

  return (
    // ✅ FIX scroll orizzontale
    <div className="min-h-dvh bg-black text-white overflow-x-hidden">
  <section className="flex flex-col items-center text-center px-2 sm:px-0 pt-3 sm:pt-5">
    <HomeLogo />
  </section>

      {/* MAIN */}
      <main className="mx-auto max-w-6xl px-4 sm:px-6 pt-7 sm:pt-12 pb-24 lg:pb-16">
        {/* Mobile-first: CTA subito, poi testo corto, poi preview */}
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start min-w-0">
          {/* COL 1 (mobile: top) */}
          <section className="space-y-4 min-w-0">
            
            <h1 className="
  max-w-[22rem]
  sm:max-w-none
  text-balance
  text-[36px]
  leading-[1.08]
  font-semibold
  tracking-tight
  text-white
">
  I colori che ti stanno bene.
  <br />
  <span className="text-white/70">In 5 secondi.</span>
</h1>

            <p className="
  mt-3
  max-w-[20rem]
  sm:max-w-xl
  text-[14px]
  leading-6
  text-white/65
">
  Analisi discreta del volto (senza filtri) → palette personale → capi coerenti.
  <br className="hidden sm:block" />
  Più sicurezza quando compri. Meno resi. Più “wow”.
</p>

            {/* CTA */}
            <div className="grid gap-2">
              <Link
  href="/scan"
  className="
    hidden sm:flex
    group relative items-center justify-center gap-3
    overflow-hidden rounded-2xl
    bg-white px-6 py-4
    text-[15px] font-semibold tracking-wide text-black
    transition active:scale-[0.99]
    shadow-[0_14px_44px_rgba(255,255,255,0.16)]
  "
>
                Effettua lo scan
                <StatusPill
                  status={cameraStatus}
                  pulse={pulseReady}
                  className="!text-black/80 !border-black/10 !bg-black/5"
                />
                <span
                  className="
                    pointer-events-none absolute inset-0
                    -translate-x-full
                    bg-gradient-to-r from-transparent via-black/5 to-transparent
                    transition-transform duration-700
                    group-hover:translate-x-full
                  "
                />
              </Link>

              <Link
  href="/scan?upload=1"
  className="hidden sm:block text-center text-[12px] text-white/60 underline underline-offset-4 hover:text-white/85 transition"
>
  Oppure carica una foto
</Link>

              {/* Perché funziona (mobile super compatto) */}
              <div className="w-full max-w-full rounded-3xl border border-white/10 bg-white/[0.03] p-4 min-w-0">
                <div className="text-[15px] font-semibold text-white/90">Perché funziona</div>
                <ul className="mt-3 space-y-3 text-[14px] leading-6">
  <li className="flex items-start gap-3">
    <span className="mt-[8px] h-[7px] w-[7px] shrink-0 rounded-full bg-white/35" />
    <span className="text-white/70">
      Evidenzia i colori che{" "}
      <span className="text-white/90 font-semibold">ti illuminano</span>
    </span>
  </li>

  <li className="flex items-start gap-3">
    <span className="mt-[8px] h-[7px] w-[7px] shrink-0 rounded-full bg-white/35" />
    <span className="text-white/70">
      Ti guida su capi{" "}
      <span className="text-white/90 font-semibold">coerenti con la palette</span>
    </span>
  </li>

  <li className="flex items-start gap-3">
    <span className="mt-[8px] h-[7px] w-[7px] shrink-0 rounded-full bg-white/35" />
    <span className="text-white/70">
      Nessuna foto salvata:{" "}
      <span className="text-white/90 font-semibold">calcolo sul dispositivo</span>
    </span>
  </li>
</ul>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="select-none cursor-default rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-white/70">
                    Risultato immediato
                  </span>
                  <span className="select-none cursor-default rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-white/70">
                    Nessun salvataggio
                  </span>
                </div>
              </div>
            </div>

            {/* Status helper (solo testo) */}
            <div className="text-center text-[12px] text-white/45">
              {cameraStatus === "ready" && "Camera pronta: apri lo scan e fai il test."}
              {cameraStatus === "locked" && "Camera bloccata: Chrome → Impostazioni sito → Camera → Consenti."}
              {(cameraStatus === "idle" || cameraStatus === "checking") && "Tip: luce naturale, volto frontale, niente filtri."}
            </div>
          </section>

          {/* COL 2 */}
          <section className="space-y-3 min-w-0">
            <div className="relative">
              <div className="beoAurora" aria-hidden />
                <div
  ref={tiltRef}
  className="w-full max-w-full min-w-0 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 overflow-hidden"
                style={{
                  ...tiltStyle,
                  transition: tiltEnabled ? "transform 140ms ease" : undefined,
                  willChange: tiltEnabled ? "transform" : undefined,
                }}
              >
                <div className="beoNoise" aria-hidden />

                {/* ✅ Niente header “strano” + niente spazio vuoto */}
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[15px] font-semibold text-white/90">Palette preview</div>
                    <div className="text-[12px] text-white/50">Esempio scorrevole</div>
                  </div>
                  <span className="hidden sm:inline-flex select-none cursor-default rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-white/70">
  Preview
</span>
                </div>

                <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                  {/* ✅ wrapper overflow-hidden = niente scroll laterale sulla pagina */}
                  <div className="beoMarquee inline-flex flex-nowrap gap-3 p-4 will-change-transform"> 
                    {marquee.map((c, idx) => (
                      <div
                        key={`${c.hex}-${idx}`}
                        className="min-w-[200px] sm:min-w-[240px] flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3"
                      >
                        <div className="relative">
                          <div className="h-11 w-11 rounded-2xl border border-white/10" style={{ background: c.hex }} />
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

                <div className="mt-3 text-[12px] text-white/45">
                  Dopo lo scan: palette + capi consigliati + condivisione.
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* STICKY CTA — mobile only (e NON deve creare scroll laterale) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3 bg-gradient-to-t from-black/90 to-transparent">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/scan"
            className="
              flex h-14 w-full items-center justify-center gap-2
              rounded-2xl bg-white text-black
              text-[15px] font-semibold tracking-wide
              active:scale-[0.99] transition
              shadow-[0_12px_36px_rgba(255,255,255,0.18)]
            "
          >
            Effettua lo scan
            <span className="select-none cursor-default rounded-full border border-black/10 bg-black/5 px-3 py-2 text-[12px] text-black/70">
              AI
            </span>
          </Link>

          <div className="mt-2 text-center text-[12px] text-white/60">
            5 secondi · Nessuna foto salvata
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import StatusPill from "@/app/components/StatusPill"; // <-- se rosso, dimmi dove sta esattamente StatusPill.tsx

type CamStatus = "idle" | "checking" | "ready" | "locked";

export default function HomePage() {
  const [cameraStatus, setCameraStatus] = useState<CamStatus>("checking");
  const [pulseReady, setPulseReady] = useState(false);

  // --- Tilt (desktop only)
  const tiltRef = useRef<HTMLDivElement | null>(null);
  const [tiltStyle, setTiltStyle] = useState<CSSProperties>({});
  const [tiltEnabled, setTiltEnabled] = useState(false);

  // Enable tilt only if fine pointer + not reduced motion
  useEffect(() => {
    const mm = window.matchMedia?.("(pointer:fine)");
    const rm = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const enabled = !!mm?.matches && !rm?.matches;
    setTiltEnabled(enabled);
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

      const rx = (0.5 - y) * 5;
      const ry = (x - 0.5) * 7;

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
              setTimeout(() => setPulseReady(false), 1200);
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

  // --- Palette preview
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
    <div className="min-h-dvh bg-black text-white">
      {/* HEADER */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 pt-5 sm:pt-6">
        <Link href="/" className="group flex items-center gap-3">
          <div className="relative h-10 w-44 sm:h-12 sm:w-52">
            <Image
              src="/logo/logo-beorganich.png"
              alt="Beorganich"
              fill
              priority
              className="object-contain opacity-90 transition duration-300 group-hover:opacity-100 drop-shadow-[0_10px_28px_rgba(255,255,255,0.07)]"
            />
          </div>

          <div className="hidden sm:block">
            <div className="text-[11px] tracking-[0.22em] text-white/55 transition duration-300 group-hover:text-white/70">
              ORGANIC COTTON • PERSONAL COLOR
            </div>
          </div>
        </Link>

        {/* SOLO SHOP */}
        <Link
          href="/shop"
          className="
            rounded-full bg-white px-4 py-2
            text-[13px] font-semibold tracking-wide text-black
            transition-all duration-300 hover:bg-white/90 active:scale-[0.97]
            shadow-[0_10px_30px_rgba(255,255,255,0.15)]
          "
        >
          Shop
        </Link>
      </header>

      {/* MAIN */}
      <main className="mx-auto max-w-6xl px-4 sm:px-6 pb-44 lg:pb-24 pt-10 sm:pt-14">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
          {/* LEFT */}
          <section className="space-y-6">
            <div className="flex items-center gap-2">
              <span className="text-[11px] tracking-[0.22em] text-white/70">PERSONAL COLOR</span>
              <span className="h-[3px] w-[3px] rounded-full bg-white/35" aria-hidden />
              <span className="text-[11px] tracking-[0.22em] text-white/45">ON-DEVICE</span>
            </div>

            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              I colori che ti stanno bene.
              <br />
              <span className="text-white/80">Selezionati in 5 secondi.</span>
            </h1>

            <p className="max-w-xl text-pretty text-[15px] sm:text-[16px] leading-7 text-white/70">
              Analisi discreta del volto (senza filtri) → palette personale → capi coerenti.
              <br />
              Più sicurezza quando compri. Meno resi. Più “wow”.
            </p>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
              <div className="text-[14px] font-semibold text-white/90">Perché funziona</div>

              <ul className="mt-3 grid gap-2 text-[13px] leading-6 text-white/70">
                <li className="flex gap-3">
                  <span className="mt-[9px] h-[5px] w-[5px] rounded-full bg-white/35" aria-hidden />
                  <span>
                    Evidenzia i colori che <span className="text-white/90 font-medium">ti illuminano</span>
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-[9px] h-[5px] w-[5px] rounded-full bg-white/35" aria-hidden />
                  <span>
                    Ti guida su capi già <span className="text-white/90 font-medium">coerenti con la palette</span>
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-[9px] h-[5px] w-[5px] rounded-full bg-white/35" aria-hidden />
                  <span>
                    Nessuna foto salvata: <span className="text-white/90 font-medium">calcolo sul dispositivo</span>
                  </span>
                </li>
              </ul>

              {/* badges NON cliccabili */}
              <div className="mt-4 flex flex-wrap gap-2">
                {["Risultato immediato", "Nessun salvataggio", "Mobile-first"].map((t) => (
                  <span
                    key={t}
                    className="cursor-default select-none rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[12px] text-white/70"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* RIGHT */}
          <section className="space-y-4">
            {/* CTA desktop/tablet ONLY (su mobile c'è lo sticky) */}
            <div className="hidden lg:grid gap-3">
              <Link
                href="/scan"
                className="
                  group relative flex items-center justify-center gap-3
                  overflow-hidden rounded-2xl
                  bg-white px-6 py-4
                  text-[15px] font-medium tracking-wide text-black
                  transition active:scale-[0.99]
                  shadow-[0_14px_44px_rgba(255,255,255,0.16)]
                "
              >
                Effettua lo scan
                <StatusPill status={cameraStatus} pulse={pulseReady} className="!text-black/80 !border-black/10 !bg-black/5" />

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
                className="block text-center text-[12px] text-white/60 underline underline-offset-4 hover:text-white/85 transition"
              >
                Oppure carica una foto
              </Link>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                <div className="text-[13px] text-white/90 font-medium">Il risultato migliore</div>
                <div className="mt-1 text-[12px] leading-6 text-white/55">
                  luce naturale · volto frontale · niente filtri
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {["Privacy-first", "Palette + capi", "0 upload auto"].map((t) => (
                    <span
                      key={t}
                      className="cursor-default select-none rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[12px] text-white/70"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* PREVIEW — compatta, senza spazio vuoto */}
            <div className="relative">
              <div className="beoAurora" aria-hidden />

              <div
                ref={tiltRef}
                className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]"
                style={{
                  ...tiltStyle,
                  transition: tiltEnabled ? "transform 140ms ease" : undefined,
                  willChange: tiltEnabled ? "transform" : undefined,
                }}
              >
                <div className="beoNoise" aria-hidden />

                {/* Header preview: pulito (niente “risultato reale” a caso) */}
                <div className="flex items-start justify-between gap-4 px-5 pt-5">
                  <div>
                    <div className="text-[14px] font-semibold text-white/90">Palette preview</div>
                    <div className="mt-1 text-[12px] text-white/55">Esempio scorrevole</div>
                  </div>

                  <span className="cursor-default select-none rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[12px] text-white/70">
                    Live demo
                  </span>
                </div>

                {/* Marquee */}
                <div className="px-5 pb-4 pt-4">
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                    <div className="beoMarquee flex gap-3 p-4">
                      {marquee.map((c, idx) => (
                        <div
                          key={`${c.hex}-${idx}`}
                          className="min-w-[210px] sm:min-w-[240px] flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3"
                        >
                          <div className="relative">
                            <div className="h-12 w-12 rounded-2xl border border-white/10" style={{ background: c.hex }} />
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

                  <div className="mt-3 text-[12px] text-white/55">
                    Dopo lo scan: palette + capi consigliati + condivisione.
                  </div>
                </div>
              </div>
            </div>

            {/* helper text leggero */}
            <div className="text-center text-[12px] text-white/45">
              {cameraStatus === "ready" && "Camera pronta: apri lo scan e fai il test."}
              {cameraStatus === "locked" && "Camera bloccata: Chrome → Impostazioni sito → Camera → Consenti."}
              {(cameraStatus === "idle" || cameraStatus === "checking") && "Tip: luce naturale, volto frontale, niente filtri."}
            </div>
          </section>
        </div>
      </main>

      {/* STICKY CTA — MOBILE ONLY (unico, niente barra bianca fantasma) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
        <div className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-gradient-to-t from-black/90 to-transparent" />

        <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3 bg-black/80 backdrop-blur">
          <div className="mx-auto max-w-md">
            <Link
              href="/scan"
              className="
                group relative flex h-14 w-full items-center justify-center gap-2
                rounded-2xl bg-white text-black
                text-[15px] font-semibold tracking-wide
                active:scale-[0.99] transition
                shadow-[0_12px_36px_rgba(255,255,255,0.18)]
              "
            >
              Effettua lo scan
              <span className="inline-flex items-center rounded-full border border-black/10 bg-black/5 px-2 py-[2px] text-[10px] font-semibold tracking-widest text-black/80">
                AI
              </span>

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

            <div className="mt-2 text-center text-[12px] text-white/60">
              5 secondi · Nessuna foto salvata
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-10">
        <div className="text-[12px] text-white/45">
          Nessuna immagine viene salvata. Il risultato è una guida di stile, non un giudizio.
        </div>
      </div>
    </div>
  );
}
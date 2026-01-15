"use client";

import StatusPill from "./components/StatusPill";
import React, { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";

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
      const x = (e.clientX - rect.left) / rect.width; // 0..1
      const y = (e.clientY - rect.top) / rect.height; // 0..1

      const rx = (0.5 - y) * 5.5; // deg
      const ry = (x - 0.5) * 7.5; // deg

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

  // --- Camera status (NO permission prompt)
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

  // --- Palette demo (luxury)
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
        {/* LEFT: logo */}
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

        {/* RIGHT: only Shop (as requested) */}
        <Link
          href="/shop"
          className="
            rounded-full
            bg-white
            px-4 py-2
            text-[13px] font-semibold tracking-wide
            text-black
            transition-all duration-300
            hover:bg-white/90
            active:scale-[0.97]
            shadow-[0_10px_30px_rgba(255,255,255,0.15)]
          "
        >
          Shop
        </Link>
      </header>

      {/* MAIN */}
      <main className="mx-auto max-w-6xl px-4 sm:px-6 pb-28 pt-10 sm:pt-14">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
          {/* LEFT – COPY (premium + diretto) */}
          <section className="space-y-6">
            <div className="inline-flex items-center gap-2">
              <span className="pill subtle cursor-default select-none">Analisi on-device</span>
              <span className="pill subtle cursor-default select-none">Zero foto salvate</span>
            </div>

            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Trova i colori che
              <br />
              <span className="text-white/90">ti fanno sembrare al top.</span>
            </h1>

            <p className="max-w-xl text-pretty text-[15px] sm:text-[16px] leading-7 text-white/70">
              In pochi secondi leggiamo le{" "}
              <span className="text-white/90 font-medium">tonalità naturali del volto</span> e ti diamo una palette
              chiara + capi coerenti.
              <br />
              <span className="text-white/90 font-medium">Niente filtri.</span> Solo scelte migliori.
            </p>

            {/* CTA BLOCK (above the fold) */}
            <div className="grid gap-3 max-w-xl">
              <Link
                href="/scan"
                className="
                  group relative flex items-center justify-center gap-2
                  overflow-hidden rounded-2xl
                  bg-white
                  px-6 py-4
                  text-[15px] font-semibold tracking-wide
                  text-black
                  transition-all duration-300
                  hover:bg-white/90
                  active:scale-[0.99]
                  shadow-[0_12px_38px_rgba(255,255,255,0.18)]
                "
              >
                Effettua lo scan
                <StatusPill status={cameraStatus} pulse={pulseReady} className="!border-black/15 !bg-black/5 !text-black/70" />
                <span
                  className="
                    pointer-events-none absolute inset-0
                    -translate-x-full
                    bg-gradient-to-r from-transparent via-black/10 to-transparent
                    transition-transform duration-700
                    group-hover:translate-x-full
                  "
                />
              </Link>

              <Link
                href="/scan?upload=1"
                className="block text-center text-[12px] text-white/55 underline underline-offset-4 hover:text-white/80 transition"
              >
                Oppure carica una foto
              </Link>

              {/* Micro-proof (non cliccabile, premium) */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                <div className="text-[13px] text-white/85 font-medium">Risultato preciso in circa 5 secondi.</div>
                <div className="mt-1 text-[12px] leading-6 text-white/55">
                  Luce naturale, volto frontale, niente filtri.
                  <br />
                  <span className="text-white/70">Nessuna immagine viene salvata.</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="pill subtle cursor-default select-none">Privacy-first</span>
                  <span className="pill subtle cursor-default select-none">Palette + capi</span>
                  <span className="pill subtle cursor-default select-none">Zero upload auto</span>
                </div>
              </div>

              {/* Status helper (solo qui, 1 volta) */}
              {cameraStatus === "locked" && (
                <div className="text-[12px] text-rose-100/70 text-center">
                  Camera bloccata: Chrome → Impostazioni sito → Camera → Consenti.
                </div>
              )}
              {(cameraStatus === "idle" || cameraStatus === "checking") && (
                <div className="text-[12px] text-white/45 text-center">
                  Tip: luce naturale + viso frontale → precisione massima.
                </div>
              )}
            </div>
          </section>

          {/* RIGHT – PREVIEW (compact, no empty space) */}
<section className="space-y-4">
  <div className="relative">
    <div className="beoAurora" aria-hidden />

    <div
      ref={tiltRef}
      className="cameraShell relative overflow-hidden h-auto min-h-0"
      style={{
        ...tiltStyle,
        transition: tiltEnabled ? "transform 140ms ease" : undefined,
        willChange: tiltEnabled ? "transform" : undefined,
      }}
    >
      <div className="beoNoise" aria-hidden />

      {/* TOP ROW — più elegante, meno “chip da cliccare” */}
      <div className="px-5 pt-5 sm:px-6 sm:pt-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[12px] tracking-[0.22em] text-white/55">
              PALETTE PREVIEW
            </div>
            <div className="mt-1 text-[15px] font-semibold text-white/90">
              Esempio di palette
            </div>
          </div>

          {/* micro-label sobria */}
          <span className="text-[12px] text-white/55 select-none">
            personalizzata
          </span>
        </div>

        <div className="mt-3 text-[12px] text-white/55">
          Lo scan genera una palette e ti guida ai capi più coerenti.
        </div>
      </div>

      {/* MARQUEE — niente inset-0, niente justify-between */}
      <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="beoMarquee flex gap-3 p-4">
            {marquee.map((c, idx) => (
              <div
                key={`${c.hex}-${idx}`}
                className="min-w-[210px] sm:min-w-[240px] flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3"
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

        {/* footer micro-copy (niente spazio extra) */}
        <div className="mt-3 text-[12px] text-white/45">
          Tip: luce naturale + niente filtri = risultato migliore.
        </div>
      </div>
    </div>
  </div>

  {/* TRUST STRIP */}
  <div className="grid gap-2">
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[12px] text-white/65">
          <span className="beoDot" aria-hidden />
          <span><span className="text-white/85 font-medium">Privacy</span>: tutto sul dispositivo</span>
        </div>

        <div className="flex items-center gap-2 text-[12px] text-white/65">
          <span className="beoDot" aria-hidden />
          <span><span className="text-white/85 font-medium">Coerenza</span>: capi scelti per palette</span>
        </div>

        <div className="flex items-center gap-2 text-[12px] text-white/65">
          <span className="beoDot" aria-hidden />
          <span><span className="text-white/85 font-medium">Meno resi</span>: colori giusti al primo colpo</span>
        </div>
      </div>
    </div>
  </div>
</section>
        </div>
      </main>

      {/* STICKY CTA — mobile only (spinge conversione) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3 bg-gradient-to-t from-black/90 to-transparent">
        <div className="mx-auto max-w-md">
          <Link
            href="/scan"
            className="
              flex h-14 w-full items-center justify-center gap-2
              rounded-2xl
              bg-white
              text-black
              text-[15px] font-semibold tracking-wide
              active:scale-[0.99]
              transition
              shadow-[0_12px_36px_rgba(255,255,255,0.18)]
            "
          >
            Effettua lo scan
            <span className="pill subtle cursor-default select-none">AI</span>
          </Link>

          <div className="mt-2 text-center text-[12px] text-white/60">
            Analisi rapida · Nessuna foto salvata
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
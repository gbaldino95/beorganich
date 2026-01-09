"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";

type CamStatus = "idle" | "checking" | "ready" | "locked";

function cx(...parts: Array<string | false | undefined | null>) {
  return parts.filter(Boolean).join(" ");
}

export default function HomePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width; // 0..1
      const y = (e.clientY - rect.top) / rect.height; // 0..1

      const rx = (0.5 - y) * 6; // deg
      const ry = (x - 0.5) * 8; // deg

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

        // Permissions API (best effort)
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
            // fallback
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

  const onPickPhoto = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // --- Mini animated palette (luxury)
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

  // duplicate list for seamless loop
  const marquee = useMemo(() => [...previewPalette, ...previewPalette], [previewPalette]);

  // --- Scan button w/ dynamic badge
  const ScanButton = ({ label }: { label: string }) => (
    <Link
      href="/scan"
      className="
        group relative flex items-center justify-center gap-2
        overflow-hidden rounded-2xl
        border border-white/20
        bg-white/[0.02]
        px-6 py-4
        text-[15px] font-medium tracking-wide
        text-white/90
        backdrop-blur
        transition-all duration-300
        hover:border-white/35
        hover:bg-white/[0.06]
        active:scale-[0.99]
      "
    >
      <span className="relative z-10">{label}</span>

      <span
        className={cx(
          "relative z-10 rounded-full border px-2 py-[2px] text-[10px] font-semibold tracking-widest backdrop-blur transition",
          cameraStatus === "ready" && "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
          cameraStatus === "locked" && "border-rose-300/30 bg-rose-300/10 text-rose-100",
          (cameraStatus === "idle" || cameraStatus === "checking") && "border-white/25 bg-white/10 text-white/80",
          pulseReady && "animate-[beoPulse_1.1s_ease-out_1]"
        )}
      >
        {cameraStatus === "ready" ? "READY" : cameraStatus === "locked" ? "LOCKED" : "AI"}
      </span>

      {/* light sweep */}
      <span
        className="
          pointer-events-none absolute inset-0
          -translate-x-full
          bg-gradient-to-r from-transparent via-white/10 to-transparent
          transition-transform duration-700
          group-hover:translate-x-full
        "
      />
    </Link>
  );

  return (
    <div className="min-h-dvh bg-black text-white">
      {/* Hidden upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;

          // (Per ora) vai su /scan in modalità upload.
          // Se vuoi "Home -> upload -> result diretto", te lo imposto dopo con sessionStorage + /result.
          window.location.href = "/scan?upload=1";
        }}
      />

      {/* HEADER */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 pt-5 sm:pt-6">
        {/* LEFT: logo + payoff */}
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

        {/* RIGHT: actions — luxury */}
        <div className="flex items-center gap-2">
          <Link
            href="/scan"
            className="
              group relative flex items-center gap-2
              overflow-hidden rounded-full
              border border-white/20
              px-4 py-2
              text-[13px] font-medium tracking-wide
              text-white/85
              backdrop-blur
              transition-all duration-300
              hover:border-white/35
              hover:bg-white/[0.06]
              active:scale-[0.97]
            "
          >
            <span className="relative z-10">Scan</span>

            <span
              className={cx(
                "relative z-10 rounded-full border px-2 py-[2px] text-[10px] font-semibold tracking-widest backdrop-blur transition",
                cameraStatus === "ready" && "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
                cameraStatus === "locked" && "border-rose-300/30 bg-rose-300/10 text-rose-100",
                (cameraStatus === "idle" || cameraStatus === "checking") && "border-white/25 bg-white/10 text-white/80",
                pulseReady && "animate-[beoPulse_1.1s_ease-out_1]"
              )}
            >
              {cameraStatus === "ready" ? "READY" : cameraStatus === "locked" ? "LOCKED" : "AI"}
            </span>

            <span
              className="
                pointer-events-none absolute inset-0
                -translate-x-full
                bg-gradient-to-r from-transparent via-white/10 to-transparent
                transition-transform duration-700
                group-hover:translate-x-full
              "
            />
          </Link>

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
        </div>
      </header>

      {/* MAIN */}
      <main className="mx-auto max-w-6xl px-4 sm:px-6 pb-28 pt-12 sm:pt-16">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
          {/* LEFT – COPY */}
          <section className="space-y-6">
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Ti consigliamo i capi
              <br />
              <span className="text-white/90">più coerenti con te.</span>
            </h1>

            <p className="max-w-xl text-pretty text-[15px] sm:text-[16px] leading-7 text-white/70">
              Analizziamo le{" "}
              <span className="text-white/90 font-medium">tonalità naturali del tuo volto</span> e ti guidiamo verso
              colori che <span className="text-white/90 font-medium">ti valorizzano davvero</span>.
              <br />
              Meno dubbi. Meno resi. Più “wow” allo specchio.
            </p>

            <div className="card">
              <div className="cardTitle">Non è un filtro. È una scelta intelligente.</div>

              <div className="mt-3 grid gap-2 text-[13px] leading-6 text-white/70">
                <div className="flex gap-2">
                  <span className="text-white/60">•</span>
                  <span>
                    Palette personale in <span className="text-white/90 font-medium">pochi secondi</span>
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-white/60">•</span>
                  <span>
                    Capi consigliati che{" "}
                    <span className="text-white/90 font-medium">illuminano pelle e occhi</span>
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-white/60">•</span>
                  <span>
                    Nessuna foto salvata. <span className="text-white/90 font-medium">Analisi privata</span>
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-[12px] text-white/55">
                <span className="pill subtle">Risultato immediato</span>
                <span className="pill subtle">Zero dati salvati</span>
                <span className="pill subtle">Mobile-first</span>
              </div>
            </div>

            <div className="text-[13px] text-white/60">
              ✨ Se ti sei mai chiesto perché alcuni colori ti “spengono”, qui hai la risposta.
              <br />
              E la soluzione — già pronta da comprare.
            </div>
          </section>

          {/* RIGHT – PREVIEW */}
          <section className="space-y-4">
            <div className="relative">
              {/* Aurora behind */}
              <div className="beoAurora" aria-hidden />

              <div
                ref={tiltRef}
                className="cameraShell relative overflow-hidden"
                style={{
                  ...tiltStyle,
                  transition: tiltEnabled ? "transform 140ms ease" : undefined,
                  willChange: tiltEnabled ? "transform" : undefined,
                }}
              >
                {/* noise overlay */}
                <div className="beoNoise" aria-hidden />

                <div className="absolute inset-0 p-6 flex flex-col justify-between">
                  <div className="flex justify-between">
                    <div className="overlayChip">Anteprima</div>
                    <div className="overlayChip subtle">Selezione su misura</div>
                  </div>

                  <div className="space-y-4">
                    <div className="text-[14px] font-semibold text-white/90">Esempio di risultato</div>

                    {/* Animated mini palette (marquee) */}
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

                    <div className="text-[12px] text-white/55">
                      Dopo lo scan: palette + capi consigliati + condivisione + accesso esclusivo allo shop.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="grid gap-3">
              <ScanButton label="Effettua lo scan" />

              <button
                onClick={onPickPhoto}
                className="
                  h-12 w-full rounded-2xl border border-white/20
                  text-[14px] tracking-wide text-white/85
                  hover:bg-white/[0.06] transition active:scale-[0.99]
                "
              >
                Carica una foto
              </button>

              {/* Tooltip persuasive + status */}
              <div className="mt-1 grid gap-1 text-center">
                <div className="text-[12px] text-white/60">
                  Analisi in <span className="text-white/80 font-medium">5 secondi</span> ·
                  <span className="text-white/80 font-medium"> Nessuna foto salvata</span>
                </div>

                {cameraStatus === "ready" && (
                  <div className="text-[12px] text-emerald-100/70">Camera pronta. Apri lo scan e fai il test.</div>
                )}
                {cameraStatus === "locked" && (
                  <div className="text-[12px] text-rose-100/70">
                    Camera bloccata: Chrome → Impostazioni sito → Camera → Consenti.
                  </div>
                )}
                {(cameraStatus === "idle" || cameraStatus === "checking") && (
                  <div className="text-[12px] text-white/45">Suggerimento: luce naturale, volto frontale, niente filtri.</div>
                )}
              </div>

              {/* TRUST STRIP */}
              <div className="mt-3 grid gap-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-[12px] text-white/65">
                      <span className="beoDot" aria-hidden />
                      <span>
                        <span className="text-white/85 font-medium">Privacy</span>: nessun upload automatico
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[12px] text-white/65">
                      <span className="beoDot" aria-hidden />
                      <span>
                        <span className="text-white/85 font-medium">Coerenza</span>: capi selezionati per palette
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[12px] text-white/65">
                      <span className="beoDot" aria-hidden />
                      <span>
                        <span className="text-white/85 font-medium">Risparmio</span>: meno tentativi, meno resi
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-center text-[12px] text-white/40">
                  Tip: il risultato migliore arriva con luce naturale e volto senza filtri.
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* FOOTER TRUST */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-10">
        <div className="text-[12px] text-white/45">
          Nessuna immagine viene salvata. Il risultato è una guida di stile, non un giudizio.
        </div>
      </div>
    </div>
  );
}
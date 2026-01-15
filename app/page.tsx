"use client";

import React, { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import StatusPill from "./components/StatusPill";

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
      const rx = (0.5 - y) * 5; // deg
      const ry = (x - 0.5) * 7; // deg

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

        {/* SOLO SHOP (come mi hai chiesto) */}
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
      <main className="mx-auto max-w-6xl px-4 sm:px-6 pb-28 pt-10 sm:pt-14">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
          {/* LEFT – COPY (Stripe-like: corto, forte, ordinato) */}
          <section className="space-y-6">
            <div className="inline-flex items-center gap-2">
              <span className="stripeEyebrow">PERSONAL COLOR</span>
              <span className="stripeDot" aria-hidden />
              <span className="stripeEyebrow text-white/55">ON-DEVICE</span>
            </div>

            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              I colori che ti stanno bene.
              <br />
              <span className="text-white/85">Selezionati in 5 secondi.</span>
            </h1>

            <p className="max-w-xl text-pretty text-[15px] sm:text-[16px] leading-7 text-white/70">
              Analisi discreta del volto (senza filtri) → palette personale → capi coerenti.
              <br />
              Più sicurezza quando compri. Meno resi. Più “wow”.
            </p>

            <div className="stripeCard">
              <div className="stripeCardTitle">Perché funziona</div>
              <ul className="stripeList">
                <li>
                  <span className="stripeBullet" aria-hidden />
                  <span>
                    Evidenzia i colori che <span className="text-white/90 font-medium">ti illuminano</span>
                  </span>
                </li>
                <li>
                  <span className="stripeBullet" aria-hidden />
                  <span>
                    Ti guida su capi già <span className="text-white/90 font-medium">coerenti con la palette</span>
                  </span>
                </li>
                <li>
                  <span className="stripeBullet" aria-hidden />
                  <span>
                    Nessuna foto salvata: <span className="text-white/90 font-medium">calcolo sul dispositivo</span>
                  </span>
                </li>
              </ul>

              {/* “Pills” che NON sembrano cliccabili */}
              <div className="stripeBadges" aria-label="vantaggi">
                <span className="stripeBadge">Risultato immediato</span>
                <span className="stripeBadge">Nessun salvataggio</span>
                <span className="stripeBadge">Mobile-first</span>
              </div>
            </div>
          </section>

          {/* RIGHT – CTA subito + preview compatta (zero spazio vuoto) */}
          <section className="space-y-4">
            {/* CTA top */}
            <div className="grid gap-3">
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

              <div className="stripeMiniProof">
                <div className="stripeMiniProofTop">
                  <div className="text-[13px] text-white/90 font-medium">Il risultato migliore</div>
                  <div className="text-[12px] text-white/55">luce naturale · volto frontale · niente filtri</div>
                </div>
                <div className="stripeMiniProofBadges">
                  <span className="stripeBadge">Privacy-first</span>
                  <span className="stripeBadge">Palette + capi</span>
                  <span className="stripeBadge">0 upload auto</span>
                </div>
              </div>
            </div>

            {/* Preview (tagliata: solo titolo + palette, NO spazio vuoto) */}
            <div className="relative">
              <div className="beoAurora" aria-hidden />

              <div
                ref={tiltRef}
                className="stripePreviewShell"
                style={{
                  ...tiltStyle,
                  transition: tiltEnabled ? "transform 140ms ease" : undefined,
                  willChange: tiltEnabled ? "transform" : undefined,
                }}
              >
                <div className="beoNoise" aria-hidden />

                {/* TOP */}
                <div className="stripePreviewTop">
                  <div>
                    <div className="stripePreviewTitle">Esempio palette</div>
                    <div className="stripePreviewSub">Scorrevole · preview</div>
                  </div>
                  <span className="stripeBadge">Preview</span>
                </div>

                {/* MARQUEE */}
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
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

                {/* Bottom note */}
                <div className="stripePreviewNote">
                  Dopo lo scan: palette + capi consigliati + condivisione.
                </div>
              </div>
            </div>

            {/* camera status helper (solo testo, niente doppioni visivi) */}
            <div className="text-center text-[12px] text-white/45">
              {cameraStatus === "ready" && "Camera pronta: apri lo scan e fai il test."}
              {cameraStatus === "locked" && "Camera bloccata: Chrome → Impostazioni sito → Camera → Consenti."}
              {(cameraStatus === "idle" || cameraStatus === "checking") && "Tip: luce naturale, volto frontale, niente filtri."}
            </div>
          </section>
        </div>
      </main>

      {/* STICKY CTA — mobile only (Stripe style: semplice) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3 bg-gradient-to-t from-black/90 to-transparent">
        <div className="mx-auto max-w-md">
          <Link
            href="/scan"
            className="
              flex h-14 w-full items-center justify-center gap-2
              rounded-2xl bg-white text-black
              text-[15px] font-medium tracking-wide
              active:scale-[0.99] transition
              shadow-[0_12px_36px_rgba(255,255,255,0.18)]
            "
          >
            Effettua lo scan
            <span className="stripeBadge !bg-black/5 !text-black/80 !border-black/10">AI</span>
          </Link>

          <div className="mt-2 text-center text-[12px] text-white/60">
            Analisi in pochi secondi · Nessuna foto salvata
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
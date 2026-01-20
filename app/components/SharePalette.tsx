"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { PaletteItem } from "@/app/lib/paletteLogic";
import html2canvas from "html2canvas";

type Props = {
  palette: PaletteItem[];
  shareUrl: string;
  title?: string;
};

function cx(...parts: Array<string | false | undefined | null>) {
  return parts.filter(Boolean).join(" ");
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export default function SharePalette({ palette, shareUrl, title = "Palette" }: Props) {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  const first3 = useMemo(() => palette.slice(0, 3), [palette]);

  const hasNativeShare = typeof window !== "undefined" && !!(navigator as any).share;

  const onCopy = useCallback(async () => {
    const ok = await copyToClipboard(shareUrl);
    setToast(ok ? "Link copiato ✅" : "Impossibile copiare 😕");
  }, [shareUrl]);

  const onOpen = useCallback(() => {
    window.open(shareUrl, "_blank", "noreferrer");
  }, [shareUrl]);

  const onNativeShare = useCallback(async () => {
    try {
      if (!(navigator as any).share) {
        setToast("Share non supportato qui 😕");
        return;
      }
      await (navigator as any).share({
        title,
        text: "Ecco la mia palette",
        url: shareUrl,
      });
      setToast("Condiviso ✅");
    } catch {
      // user closed share: ignore
    }
  }, [shareUrl, title]);

  // ✅ Salva in galleria (PNG)
  const onSavePaletteToGallery = useCallback(async () => {
    try {
      const el = document.getElementById("palette-export");
      if (!el) {
        setToast("Errore: palette non trovata 😕");
        return;
      }

      setToast("Salvataggio…");

      const canvas = await html2canvas(el, {
        backgroundColor: "#0b0b0b",
        scale: Math.min(3, window.devicePixelRatio || 2),
        useCORS: true,
      });

      const dataUrl = canvas.toDataURL("image/png");

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "UNYFORM-palette.png";
      document.body.appendChild(a);
      a.click();
      a.remove();

      setToast("Salvata ✅");
    } catch {
      setToast("Impossibile salvare 😕");
    }
  }, []);

  return (
    <div className="resultMiniCard">
      <div className="resultMiniCardInner">
        <div className="resultMiniTop">
          <div>
            <div className="resultMiniTitle">Condividi</div>
            <div className="resultMiniSub">Salva la palette o il link: riapri quando vuoi.</div>
          </div>

          {/* tiny swatches */}
          <div className="flex items-center gap-2">
            {first3.map((p) => (
              <div
                key={p.hex}
                className="h-7 w-7 rounded-xl border border-white/10"
                style={{ background: p.hex }}
                title={p.hex}
              />
            ))}
          </div>
        </div>

        {/* ✅ Questo è ciò che viene "fotografato" per il PNG */}
        <div
          id="palette-export"
          className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-4"
        >
          <div className="text-[12px] tracking-[0.22em] text-white/55 uppercase">
            UNYFORM · Palette
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            {palette.slice(0, 6).map((p) => (
              <div
                key={p.hex}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
              >
                <div className="relative">
                  <div
                    className="h-10 w-10 rounded-2xl border border-white/10"
                    style={{ background: p.hex }}
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-white/90 truncate">
                    {p.name}
                  </div>
                  <div className="text-[11px] text-white/55 font-mono">{p.hex}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 text-[11px] text-white/45">
            Screenshot-safe · nessuna foto salvata
          </div>
        </div>

        <div className="resultMiniActions">
          <button className="resultMiniBtnPrimary" onClick={onCopy}>
            Copia link
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button className="resultMiniBtnGhost" onClick={onOpen}>
              Apri
            </button>

            <button className="resultMiniBtnPrimary" onClick={onSavePaletteToGallery}>
              Salva in galleria
            </button>
          </div>

          <button
            className={cx("resultMiniBtnGhost", !hasNativeShare && "opacity-60")}
            onClick={onNativeShare}
            disabled={!hasNativeShare}
            title={!hasNativeShare ? "Non supportato su questo browser" : undefined}
          >
            Condividi
          </button>

          {toast && <div className="resultMiniToast">{toast}</div>}

          <div className="resultMiniFineprint">
            Nessuna foto salvata. Condividi solo il risultato (palette), non l’immagine.
          </div>
        </div>
      </div>
    </div>
  );
}
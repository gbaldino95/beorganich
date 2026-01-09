"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { PaletteItem } from "@/app/lib/paletteLogic";

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

  const hasNativeShare = typeof window !== "undefined" && !!(navigator as any).share;

  return (
    <div className="resultMiniCard">
      <div className="resultMiniCardInner">
        <div className="resultMiniTop">
          <div>
            <div className="resultMiniTitle">Condividi</div>
            <div className="resultMiniSub">Salva il link: riapri la palette quando vuoi.</div>
          </div>

          {/* tiny swatches (wow micro-detail) */}
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

        <div className="resultMiniActions">
          <button className="resultMiniBtnPrimary" onClick={onCopy}>
            Copia link
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button className="resultMiniBtnGhost" onClick={onOpen}>
              Apri
            </button>

            <button
              className={cx("resultMiniBtnGhost", !hasNativeShare && "opacity-60")}
              onClick={onNativeShare}
              disabled={!hasNativeShare}
              title={!hasNativeShare ? "Non supportato su questo browser" : undefined}
            >
              Condividi
            </button>
          </div>

          {toast && <div className="resultMiniToast">{toast}</div>}

          <div className="resultMiniFineprint">
            Nessuna foto salvata. Condividi solo il risultato (palette), non l’immagine.
          </div>
        </div>
      </div>
    </div>
  );
}
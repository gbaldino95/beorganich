"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { PaletteItem } from "@/app/lib/paletteLogic";

type Props = {
  palette: PaletteItem[];
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function EmailGate({ palette }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  // toast auto-hide
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2400);
    return () => clearTimeout(t);
  }, [msg]);

  const trimmedEmail = email.trim();
  const canSend = isValidEmail(trimmedEmail) && status !== "sending";

  const payload = useMemo(() => {
    return {
      email: trimmedEmail,
      palette: (palette ?? []).map((p) => ({ name: p.name, hex: p.hex })),
      url: typeof window !== "undefined" ? window.location.href : undefined,
      ts: Date.now(),
    };
  }, [trimmedEmail, palette]);

  const onSubmit = useCallback(async () => {
    if (!isValidEmail(trimmedEmail)) {
      setMsg("Inserisci un’email valida.");
      setStatus("idle");
      return;
    }

    setStatus("sending");
    setMsg(null);

    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Request failed");
      }

      setStatus("done");
      setMsg("Inviato ✅ Controlla la mail: ti ho mandato la tua palette.");
    } catch (err: any) {
      console.error("EmailGate ERROR:", err?.message || err);
      setStatus("error");
      setMsg("Errore 😕 Riprova tra poco.");
    }
  }, [payload, trimmedEmail]);

  return (
    <div className="resultMiniCard">
      <div className="resultMiniCardInner">
        <div className="resultMiniTop">
          <div>
            <div className="resultMiniTitle">Accesso prioritario</div>
            <div className="resultMiniSub">
              Ti inviamo la tua palette + nuove uscite già filtrate. Zero spam. Solo cose coerenti.
            </div>
          </div>
        </div>

        {/* ✅ ridotto lo spacing: nel tuo era gap-10 (enorme) */}
        <div className="mt-4 grid gap-3">
          <div className="grid gap-2">
            <label className="text-[12px] text-white/55">Email</label>

            <input
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (status === "done") setStatus("idle");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (canSend) onSubmit();
                  else setMsg("Inserisci un’email valida.");
                }
              }}
              placeholder="nome@email.com"
              className="resultMiniInput"
              inputMode="email"
              autoComplete="email"
              aria-label="Email"
            />
          </div>

          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSend}
            className="resultMiniBtnPrimary"
            aria-disabled={!canSend}
            style={{
              opacity: canSend ? 1 : 0.55,
              cursor: canSend ? "pointer" : "not-allowed",
            }}
          >
            {status === "sending"
              ? "Invio…"
              : status === "done"
              ? "Inviato ✓"
              : status === "error"
              ? "Riprova invio"
              : "Invia la mia palette"}
          </button>

          {msg && (
            <div
              className="resultMiniToast"
              role="status"
              aria-live="polite"
              style={{
                pointerEvents: "none", // ✅ evita che un toast “copra” il bottone
              }}
            >
              {msg}
            </div>
          )}

          <div className="resultMiniFineprint">
            Niente spam. Ti scriviamo solo quando c’è qualcosa di davvero coerente con te.
          </div>
        </div>
      </div>
    </div>
  );
}
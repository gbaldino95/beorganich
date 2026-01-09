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

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2000);
    return () => clearTimeout(t);
  }, [msg]);

  const payload = useMemo(() => {
    // minimo indispensabile
    return {
      email: email.trim(),
      palette: palette.map((p) => ({ name: p.name, hex: p.hex })),
      ts: Date.now(),
    };
  }, [email, palette]);

  const canSend = isValidEmail(email) && status !== "sending";

  const onSubmit = useCallback(async () => {
    if (!canSend) {
      setMsg("Inserisci un’email valida.");
      return;
    }

    setStatus("sending");
    setMsg(null);

    try {
      // ✅ TODO: collega il tuo endpoint (es: /api/lead)
      // const res = await fetch("/api/lead", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify(payload),
      // });
      // if (!res.ok) throw new Error("bad");

      // Simulazione success (rimuovi quando colleghi l’API)
      await new Promise((r) => setTimeout(r, 450));

      setStatus("done");
      setMsg("Salvato ✅ Ti aggiorneremo con i capi perfetti per te.");
    } catch {
      setStatus("error");
      setMsg("Errore 😕 Riprova.");
    } finally {
      if (status !== "done") {
        // keep email for retry
      }
    }
  }, [canSend, payload, status]);

  return (
    <div className="resultMiniCard">
      <div className="resultMiniCardInner">
        <div className="resultMiniTop">
          <div>
            <div className="resultMiniTitle">Accesso prioritario</div>
            <div className="resultMiniSub">
              Ricevi nuove uscite già filtrate per la tua palette. Zero perdite di tempo.
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-10">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="La tua email"
            className="resultMiniInput"
            inputMode="email"
            autoComplete="email"
          />

          <button
            onClick={onSubmit}
            disabled={!canSend}
            className="resultMiniBtnPrimary"
            style={{
              opacity: canSend ? 1 : 0.55,
              cursor: canSend ? "pointer" : "not-allowed",
            }}
          >
            {status === "sending" ? "Invio…" : status === "done" ? "Attivato ✓" : "Ricevi consigli su misura"}
          </button>

          {msg && <div className="resultMiniToast">{msg}</div>}

          <div className="resultMiniFineprint">
            Niente spam. Ti scriviamo solo quando c’è qualcosa di davvero coerente con te.
          </div>
        </div>
      </div>
    </div>
  );
}
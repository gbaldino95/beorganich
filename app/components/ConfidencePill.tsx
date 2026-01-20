"use client";

import React, { useMemo } from "react";

type Props = {
  value: number; // 0..100
  label?: string;
  hint?: string;
  className?: string;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function tier(v: number) {
  if (v >= 88) return { title: "Eccellente", sub: "Risultato molto affidabile" };
  if (v >= 74) return { title: "Ottimo", sub: "Affidabile per acquisti coerenti" };
  if (v >= 62) return { title: "Buono", sub: "Ok, ma puoi migliorare la luce" };
  return { title: "Basso", sub: "Rifai con luce naturale e volto frontale" };
}

export default function ConfidencePill({ value, label = "Confidence", hint, className }: Props) {
  const v = clamp(Math.round(value), 0, 100);

  const t = useMemo(() => tier(v), [v]);
  const fill = v;

  return (
    <div
      className={[
        "rounded-3xl border border-white/10 bg-white/[0.03] p-4",
        "shadow-[0_20px_60px_rgba(0,0,0,0.35)]",
        className ?? "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[12px] tracking-[0.22em] text-white/55 uppercase">
            {label}
          </div>
          <div className="mt-1 text-[16px] font-semibold text-white/90">
            {t.title} <span className="text-white/45 font-medium">({v}%)</span>
          </div>
          <div className="mt-1 text-[12px] text-white/55">
            {hint ?? t.sub}
          </div>
        </div>

        <div className="shrink-0 rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
          <div className="text-[11px] text-white/55">AI</div>
          <div className="text-[13px] font-semibold text-white/90 tabular-nums">{v}</div>
        </div>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-white/70 transition-[width] duration-500"
          style={{ width: `${fill}%` }}
          aria-hidden
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[11px] text-white/65">
          Luce
        </span>
        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[11px] text-white/65">
          Nitidezza
        </span>
        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[11px] text-white/65">
          Stabilità
        </span>
      </div>
    </div>
  );
}
"use client";

import React from "react";

type CamStatus = "idle" | "checking" | "ready" | "locked";

export default function StatusPill({
  status,
  pulse,
  className = "",
}: {
  status: CamStatus;
  pulse?: boolean;
  className?: string;
}) {
  const label =
    status === "ready" ? "CAM READY" : status === "locked" ? "CAM LOCKED" : "AI";

  const tone =
    status === "ready"
      ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
      : status === "locked"
      ? "border-rose-300/30 bg-rose-300/10 text-rose-100"
      : "border-white/25 bg-white/10 text-white/80";

  return (
    <span
      className={[
        "relative z-10 inline-flex items-center gap-2 rounded-full border px-2 py-[2px] text-[10px] font-semibold tracking-widest backdrop-blur select-none cursor-default",
        tone,
        pulse ? "animate-[beoPulse_1.1s_ease-out_1]" : "",
        className,
      ].join(" ")}
      aria-label={label}
    >
      <span className="h-[6px] w-[6px] rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
}
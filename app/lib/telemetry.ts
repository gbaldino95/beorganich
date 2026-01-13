"use client";

function getSessionId() {
  const KEY = "beo:sid:v1";
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;

    const sid =
      (crypto as any)?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    localStorage.setItem(KEY, sid);
    return sid;
  } catch {
    // fallback RAM
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

export async function trackEvent(
  event: string,
  data: Record<string, any> = {},
  path?: string
) {
  try {
    const payload = {
      event,
      path: path ?? (typeof window !== "undefined" ? window.location.pathname : "/"),
      sessionId: getSessionId(),

      // fields “standard”
      method: data.method,
      confidence: data.confidence,
      quality: data.quality,
      undertone: data.undertone,
      depth: data.depth,
      samples: data.samples,

      // extra
      payload: data,
    };

    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // silent
  }
}
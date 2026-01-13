import { NextResponse } from "next/server";
import { getSql } from "@/app/lib/db";

/* ---------------- Utils ---------------- */
function clampInt(v: any, min: number, max: number): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/* ---------------- POST handler ---------------- */
export async function POST(req: Request) {
  try {
    // ✅ se manca DB → non blocchiamo l’app
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ ok: true });
    }

    const sql = getSql();

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const event = String(body.event ?? "").slice(0, 64);
    const path = String(body.path ?? "/").slice(0, 200);
    const sessionId = String(body.sessionId ?? "").slice(0, 80);

    if (!event || !sessionId) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const method = body.method ? String(body.method).slice(0, 16) : null;
    const confidence = clampInt(body.confidence, 0, 100);
    const quality = clampInt(body.quality, 0, 100);
    const samples = clampInt(body.samples, 0, 9999);

    const undertone = body.undertone ? String(body.undertone).slice(0, 16) : null;
    const depth = body.depth ? String(body.depth).slice(0, 16) : null;

    const ua = req.headers.get("user-agent")?.slice(0, 240) ?? null;

    // payload extra anonimo (NO immagini / NO base64)
    const payload =
      body.payload && typeof body.payload === "object" ? body.payload : null;

    await sql`
      insert into public.telemetry_events
        (event, path, session_id, method, confidence, quality, undertone, depth, samples, ua, payload)
      values
        (
          ${event},
          ${path},
          ${sessionId},
          ${method},
          ${confidence},
          ${quality},
          ${undertone},
          ${depth},
          ${samples},
          ${ua},
          ${payload}
        )
    `;

    return NextResponse.json({ ok: true });
  } catch (err) {
    // 🔒 Telemetria NON deve mai rompere UX
    return NextResponse.json({ ok: true });
  }
}
import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs"; // stabile (evita problemi edge)

const sql = neon(process.env.DATABASE_URL!);

function clampInt(n: any, min: number, max: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.max(min, Math.min(max, Math.round(x)));
}

export async function POST(req: Request) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ ok: false, error: "Missing DATABASE_URL" }, { status: 500 });
    }

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

    // payload extra anonimo (non mettere foto/base64!)
    const payload = body.payload && typeof body.payload === "object" ? body.payload : null;

    await sql`
      insert into public.telemetry_events
        (event, path, session_id, method, confidence, quality, undertone, depth, samples, ua, payload)
      values
        (${event}, ${path}, ${sessionId}, ${method}, ${confidence}, ${quality}, ${undertone}, ${depth}, ${samples}, ${ua}, ${payload})
    `;

    return NextResponse.json({ ok: true });
  } catch {
    // non bloccare UX se Neon ha problemi
    return NextResponse.json({ ok: true });
  }
}
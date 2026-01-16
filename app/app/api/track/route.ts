import { NextResponse } from "next/server";
import { getSql } from "@/app/lib/db";

function clampInt(v: any, min: number, max: number): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export async function POST(req: Request) {
  try {
    // ✅ Se manca DB, non blocchiamo mai l'app
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    // accetta sia {event} sia {name}
    const name = String((body as any).event ?? (body as any).name ?? "").slice(0, 64);
    const page = String((body as any).path ?? (body as any).page ?? "/").slice(0, 200);
    const sessionId = String((body as any).sessionId ?? "").slice(0, 80);

    if (!name || !sessionId) {
      return NextResponse.json({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
    }

    const method = (body as any).method ? String((body as any).method).slice(0, 16) : null;

    // device: se già lo mandi bene, altrimenti lo stimiamo da UA
    const ua = req.headers.get("user-agent")?.slice(0, 240) ?? null;
    const deviceRaw = (body as any).device ? String((body as any).device).slice(0, 16) : null;
    const device =
      deviceRaw ??
      (ua && /Mobi|Android|iPhone|iPad/i.test(ua) ? "mobile" : "desktop");

    const confidence = clampInt((body as any).confidence, 0, 100);
    const quality = clampInt((body as any).quality, 0, 100);
    const samples = clampInt((body as any).samples, 0, 9999);

    const undertone = (body as any).undertone ? String((body as any).undertone).slice(0, 16) : null;
    const depth = (body as any).depth ? String((body as any).depth).slice(0, 16) : null;

    const L = clampInt((body as any).L ?? (body as any)?.lab?.L, 0, 100);
    const a = clampInt((body as any).a ?? (body as any)?.lab?.a, -160, 160);
    const b = clampInt((body as any).b ?? (body as any)?.lab?.b, -160, 160);

    // props = payload libero (NO immagini, NO base64)
    const props =
      (body as any).payload && typeof (body as any).payload === "object"
        ? (body as any).payload
        : (body as any).props && typeof (body as any).props === "object"
        ? (body as any).props
        : {};

    const sql = getSql();

    await sql`
      insert into public.events
        (session_id, name, page, method, device, ua,
         confidence, quality, samples,
         undertone, depth, l, a, b,
         props)
      values
        (${sessionId}, ${name}, ${page}, ${method}, ${device}, ${ua},
         ${confidence}, ${quality}, ${samples},
         ${undertone}, ${depth}, ${L}, ${a}, ${b},
         ${props}::jsonb)
    `;

    return NextResponse.json({ ok: true });
  } catch {
    // ✅ telemetria non deve mai rompere UX
    return NextResponse.json({ ok: true });
  }
}
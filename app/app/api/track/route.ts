import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs"; // importante per Next (evita edge issues)

type TrackBody = {
  sessionId: string;
  name: string;
  page?: string;
  method?: "camera" | "upload";
  device?: "mobile" | "desktop";
  ua?: string;
  confidence?: number;
  quality?: number;
  samples?: number;
  undertone?: "warm" | "cool" | "neutral";
  depth?: "light" | "medium" | "deep";
  lab?: { L: number; a: number; b: number };
  props?: Record<string, any>;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as TrackBody;

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ ok: false, error: "Missing DATABASE_URL" }, { status: 500 });
    }

    if (!body?.sessionId || !body?.name) {
      return NextResponse.json({ ok: false, error: "Missing sessionId/name" }, { status: 400 });
    }

    const sql = neon(process.env.DATABASE_URL);

    const L = body.lab?.L ?? null;
    const a = body.lab?.a ?? null;
    const b = body.lab?.b ?? null;

    await sql`
      insert into events (
        session_id, name, page, method, device, ua,
        confidence, quality, samples, undertone, depth, l, a, b, props
      ) values (
        ${body.sessionId},
        ${body.name},
        ${body.page ?? null},
        ${body.method ?? null},
        ${body.device ?? null},
        ${body.ua ?? null},
        ${body.confidence ?? null},
        ${body.quality ?? null},
        ${body.samples ?? null},
        ${body.undertone ?? null},
        ${body.depth ?? null},
        ${L},
        ${a},
        ${b},
        ${body.props ?? {}}
      )
    `;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "track_failed" }, { status: 500 });
  }
}
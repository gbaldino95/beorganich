import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

type LeadBody = {
  sessionId: string;
  email: string;
  consentMarketing?: boolean;
  source?: string;
  meta?: Record<string, any>;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as LeadBody;

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ ok: false, error: "Missing DATABASE_URL" }, { status: 500 });
    }

    if (!body?.sessionId || !body?.email || !isEmail(body.email)) {
      return NextResponse.json({ ok: false, error: "Invalid email/sessionId" }, { status: 400 });
    }

    const sql = neon(process.env.DATABASE_URL);

    await sql`
      insert into leads (session_id, email, consent_marketing, source, meta)
      values (
        ${body.sessionId},
        ${body.email.toLowerCase()},
        ${body.consentMarketing ?? false},
        ${body.source ?? null},
        ${body.meta ?? {}}
      )
      on conflict (email)
      do update set
        session_id = excluded.session_id,
        consent_marketing = excluded.consent_marketing,
        source = excluded.source,
        meta = excluded.meta
    `;

    // opzionale: registra anche un evento
    await sql`
      insert into events (session_id, name, page, props)
      values (${body.sessionId}, 'EmailSubmitted', '/result', ${body.meta ?? {}})
    `;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "lead_failed" }, { status: 500 });
  }
}
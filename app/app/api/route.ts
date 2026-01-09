import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // MVP: per ora non inviamo email reali.
    // Qui poi collegheremo Supabase + Resend/SendGrid.
    console.log("SUBSCRIBE:", body);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
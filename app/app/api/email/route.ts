export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Resend } from "resend";

type PaletteColor = { name: string; hex: string };

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function esc(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildHtml(opts: { styleName?: string | null; palette?: PaletteColor[]; url?: string | null }) {
  const styleName = esc(opts.styleName ?? "La tua palette");
  const url = opts.url ? esc(opts.url) : "";
  const palette = Array.isArray(opts.palette) ? opts.palette.slice(0, 12) : [];

  const swatches = palette
    .map((c) => {
      const name = esc(c.name ?? "");
      const hex = esc(c.hex ?? "");
      return `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid rgba(255,255,255,.10);border-radius:14px;background:rgba(255,255,255,.04);">
          <div style="width:42px;height:42px;border-radius:14px;background:${hex};border:1px solid rgba(255,255,255,.12)"></div>
          <div style="display:flex;flex-direction:column;gap:2px;">
            <div style="font-size:14px;font-weight:600;color:#fff;opacity:.92;">${name}</div>
            <div style="font-size:12px;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;color:#fff;opacity:.55;">${hex}</div>
          </div>
        </div>
      `;
    })
    .join("");

  return `
  <div style="margin:0;padding:0;background:#000;color:#fff;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
    <div style="max-width:640px;margin:0 auto;padding:28px 18px;">
      <div style="letter-spacing:.28em;font-size:12px;opacity:.55;">BEORGANICH</div>

      <h1 style="margin:14px 0 6px;font-size:28px;line-height:1.15;">
        ${styleName}
      </h1>

      <p style="margin:0 0 18px;font-size:14px;line-height:1.7;opacity:.72;">
        Ecco la tua palette. Nessuna immagine viene salvata: è una guida di stile rapida per comprare senza dubbi.
      </p>

      ${
        palette.length
          ? `<div style="display:grid;grid-template-columns:1fr;gap:10px;margin:14px 0 18px;">${swatches}</div>`
          : `<div style="margin:16px 0 18px;padding:14px;border:1px solid rgba(255,255,255,.10);border-radius:16px;background:rgba(255,255,255,.04);opacity:.8;">
               Palette non disponibile (scan su altro device o storage svuotato).
             </div>`
      }

      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;">
        <a href="${url || "https://beorganich.vercel.app/shop"}"
           style="display:inline-flex;align-items:center;justify-content:center;height:44px;padding:0 16px;border-radius:14px;background:#fff;color:#000;text-decoration:none;font-weight:700;">
          Vai allo shop →
        </a>
        ${
          url
            ? `<a href="${url}"
                 style="display:inline-flex;align-items:center;justify-content:center;height:44px;padding:0 16px;border-radius:14px;background:rgba(255,255,255,.06);color:#fff;text-decoration:none;border:1px solid rgba(255,255,255,.12);">
                Apri il risultato
              </a>`
            : ""
        }
      </div>

      <div style="margin-top:18px;font-size:12px;opacity:.45;line-height:1.6;">
        Tip: luce naturale, volto frontale, niente filtri.
        <br/>Se non hai richiesto questa email puoi ignorarla.
      </div>
    </div>
  </div>
  `;
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM;

    // se manca config → non rompere UX
    if (!apiKey || !from) return NextResponse.json({ ok: true, skipped: true });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ ok: false }, { status: 400 });

    const email = String((body as any).email ?? "").trim();
    if (!isEmail(email)) return NextResponse.json({ ok: false, error: "INVALID_EMAIL" }, { status: 400 });

    const styleName = (body as any).styleName ? String((body as any).styleName).slice(0, 80) : null;

    const paletteRaw = (body as any).palette;
    const palette: PaletteColor[] = Array.isArray(paletteRaw)
      ? paletteRaw.slice(0, 12).map((c: any) => ({
          name: String(c?.name ?? "").slice(0, 40),
          hex: String(c?.hex ?? "").slice(0, 12),
        }))
      : [];

    const url = (body as any).url ? String((body as any).url).slice(0, 400) : null;

    const resend = new Resend(apiKey);
    const subject = styleName ? `La tua palette: ${styleName}` : "La tua palette Beorganich";
    const html = buildHtml({ styleName, palette, url });

    const result = await resend.emails.send({ from, to: email, subject, html });

    if ((result as any)?.error) {
      console.error("RESEND send error:", (result as any).error);
      return NextResponse.json({ ok: false, error: "SEND_FAILED" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("EMAIL API ERROR:", err);
    return NextResponse.json({ ok: true }); // non rompere UX
  }
}

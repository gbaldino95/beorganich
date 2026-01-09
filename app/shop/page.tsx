"use client";

export default function ShopPage() {
  // URL provvisorio (poi lo cambiamo con quello vero)
  const SHOPIFY_URL = "https://beorganich-official.myshopify.com";

  return (
    <main className="min-h-[100svh] bg-neutral-950 text-neutral-100">
      <div className="sticky top-0 z-20 border-b border-white/10 bg-neutral-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
          <div>
            <div className="text-[11px] tracking-[0.18em] text-white/55">BEORGANICH</div>
            <div className="text-sm font-semibold tracking-tight">Shop</div>
          </div>

          <a
            href="/scan"
            className="rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/85 hover:bg-white/[0.07]"
          >
            Torna allo Scan
          </a>
        </div>
      </div>

      <div className="mx-auto max-w-xl px-4 pb-[calc(120px+env(safe-area-inset-bottom))] pt-6">
        <div className="text-2xl font-semibold tracking-tight">Selezione beorganich</div>
        <div className="mt-2 text-sm leading-relaxed text-white/60">
          Cotone organico. Fit premium. Palette coerente.
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
          <div className="text-sm font-semibold text-white/90">Apri lo shop ufficiale</div>
          <div className="mt-3 grid gap-3">
            <a
              href={SHOPIFY_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-semibold text-neutral-950 hover:opacity-90"
            >
              Vai allo Shop
            </a>

            <a
              href={`${SHOPIFY_URL}/collections/all`}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-sm font-semibold text-white/90 hover:bg-white/[0.07]"
            >
              Catalogo completo
            </a>

            {/* Deep link palette (placeholder) */}
            <div className="mt-2 grid grid-cols-3 gap-2">
              <a
                href={`${SHOPIFY_URL}/collections/palette-warm`}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-center text-xs font-semibold text-white/80 hover:bg-white/[0.06]"
              >
                Warm
              </a>
              <a
                href={`${SHOPIFY_URL}/collections/palette-neutral`}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-center text-xs font-semibold text-white/80 hover:bg-white/[0.06]"
              >
                Neutral
              </a>
              <a
                href={`${SHOPIFY_URL}/collections/palette-cool`}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-center text-xs font-semibold text-white/80 hover:bg-white/[0.06]"
              >
                Cool
              </a>
            </div>

            <div className="text-xs text-white/45">
              (Placeholder) Poi creeremo queste collection su Shopify.
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-neutral-950/70 backdrop-blur">
        <div className="mx-auto max-w-xl px-4 py-3" style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
          <a
            href={SHOPIFY_URL}
            target="_blank"
            rel="noreferrer"
            className="block w-full rounded-2xl bg-white px-4 py-3 text-center text-base font-semibold text-neutral-950 hover:opacity-90"
          >
            Apri lo Shop
          </a>
        </div>
      </div>
    </main>
  );
}
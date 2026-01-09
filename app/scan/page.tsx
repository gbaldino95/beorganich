// app/scan/page.tsx
import { Suspense } from "react";
import ScanClient from "./ScanClient";

export default function ScanPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-black text-white grid place-items-center">Caricamento…</div>}>
      <ScanClient />
    </Suspense>
  );
}
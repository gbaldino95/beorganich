import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "beorganich",
    template: "%s · beorganich",
  },
  description:
    "Palette personale e shop premium in cotone organico. Nessuna foto salvata.",
  applicationName: "beorganich",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "beorganich",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
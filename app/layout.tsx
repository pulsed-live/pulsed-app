import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pulsed — live music map",
  description: "the future of music culture",
};

// viewport-fit=cover exposes env(safe-area-inset-*) so UI panels
// can dodge the Dynamic Island / notch on iPhone.
// width + initialScale must be explicit or Next.js may omit them, which
// prevents env(safe-area-inset-top) from returning a non-zero value.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ background: '#0a0a0f' }}>
      <body>{children}</body>
    </html>
  );
}

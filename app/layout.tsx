import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pulsed — live music map",
  description: "the future of music culture",
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

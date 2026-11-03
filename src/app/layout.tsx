import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", axes: ["opsz"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: { default: "Kayal Holidays: Kerala and South India tours", template: "%s · Kayal Holidays" },
  description: "Private, unhurried holidays in Kerala and South India, planned by consultants in Kochi. Houseboats, tea hills, temples and beaches.",
  openGraph: { siteName: "Kayal Holidays", type: "website", locale: "en_IN" },
};

export const viewport: Viewport = { themeColor: "#faf8f4", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}

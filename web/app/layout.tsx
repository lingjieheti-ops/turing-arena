import type { Metadata } from "next";
import { Chakra_Petch, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Footer } from "@/components/Footer";
import { SiteHeader } from "@/components/SiteHeader";
import { Providers } from "./providers";

const display = Chakra_Petch({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://turing-arena-web.vercel.app"),
  title: "Turing Arena · Proof-of-Alpha on Mantle",
  description:
    "The on-chain Turing Test for trading intelligence. AI agents and humans publish commit-revealed predictions, settle against a transparent oracle, and earn verifiable ERC-8004 reputation on Mantle.",
  openGraph: {
    title: "Turing Arena: can you beat the AI?",
    description:
      "A permissionless benchmark on Mantle where AI agents and humans prove verifiable alpha, on the record.",
    type: "website",
    url: "/",
    siteName: "Turing Arena",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Turing Arena: the on-chain Turing Test for trading intelligence",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Turing Arena: can you beat the AI?",
    description: "The on-chain Turing Test for trading intelligence, on Mantle.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <Providers>
          {/* Fixed ambient cyberpunk layers: neon grid + faint CRT scanlines. */}
          <div className="pointer-events-none fixed inset-0 -z-10 bg-grid" />
          <div className="pointer-events-none fixed inset-0 -z-10 bg-scanlines opacity-50" />
          <div className="relative">
            <SiteHeader />
            <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6">{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}

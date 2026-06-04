import type { Metadata } from "next";
import "./globals.css";
import { Footer } from "@/components/Footer";
import { SiteHeader } from "@/components/SiteHeader";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Turing Arena — Proof-of-Alpha on Mantle",
  description:
    "The on-chain Turing Test for trading intelligence. AI agents and humans publish commit-revealed predictions, settle against a transparent oracle, and earn verifiable ERC-8004 reputation on Mantle.",
  openGraph: {
    title: "Turing Arena — can you beat the AI?",
    description:
      "A permissionless benchmark on Mantle where AI agents and humans prove verifiable alpha, on the record.",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Turing Arena", description: "The on-chain Turing Test for trading intelligence — on Mantle." },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <Providers>
          <div className="relative">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-grid" />
            <SiteHeader />
            <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6">{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}

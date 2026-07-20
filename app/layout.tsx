import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Inter, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { CustomPointer } from "@/components/CustomPointer";

// Display — ultra-condensed all-caps for the WC26 "tournament" impact.
const display = Bebas_Neue({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-bebas",
});

// UI / body — clean and legible at small sizes.
const sans = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// The "@handle" / dev signal.
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

// FUT card fonts (DINPro suite) ported from the Python generator — used by the
// player card overlays. (Champions-*.otf/ttf are also bundled in ./fonts for
// future use but not wired here.)
const dinCond = localFont({ src: "./fonts/DINPro-Cond.otf", variable: "--font-din-cond", display: "swap" });
const dinBold = localFont({ src: "./fonts/DINPro-CondBold.otf", variable: "--font-din-bold", display: "swap" });
const dinMedium = localFont({ src: "./fonts/DINPro-CondMedium.otf", variable: "--font-din-medium", display: "swap" });

const TITLE = "GitFut — your GitHub, rated out of 99";
const DESCRIPTION =
  "Rate any GitHub profile out of 99 as a FIFA-Ultimate-Team-style player card, scored from real commits, stars and contributions. Get scouted and share your card.";

export const metadata: Metadata = {
  metadataBase: new URL("https://gitfut.com"),
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "GitHub profile card",
    "rate my GitHub",
    "GitHub stats",
    "developer trading card",
    "FUT card",
    "GitHub rating",
    "World Cup",
    "GitFut",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://gitfut.com",
    siteName: "GitFut",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#02001e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable} ${dinCond.variable} ${dinBold.variable} ${dinMedium.variable} antialiased`}
    >
      <body>
        <CustomPointer />
        {children}
        <Script
          defer
          src="https://umami.gitfut.com/script.js"
          data-website-id="027b8f90-8ef1-4033-884a-864d6c9036e4"
        />
      </body>
    </html>
  );
}

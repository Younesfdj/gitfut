import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Inter, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

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

export const metadata: Metadata = {
  metadataBase: new URL("https://gitfut.com"),
  title: "GitFut — your GitHub, rated out of 99",
  description: "Turn any GitHub profile into a World-Cup-style player card rated out of 99. Get scouted.",
  openGraph: {
    title: "GitFut — your GitHub, rated out of 99",
    description: "Turn any GitHub profile into a World-Cup-style player card rated out of 99. Get scouted.",
    url: "https://gitfut.com",
    siteName: "GitFut",
  },
  twitter: {
    card: "summary_large_image",
    title: "GitFut — your GitHub, rated out of 99",
    description: "Turn any GitHub profile into a World-Cup-style player card rated out of 99.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d1117",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable} ${dinCond.variable} ${dinBold.variable} ${dinMedium.variable} antialiased`}
    >
      <body>{children}</body>
    </html>
  );
}

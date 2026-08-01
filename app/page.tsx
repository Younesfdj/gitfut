import Background from "@/components/Background";
import AppShell from "@/components/AppShell";
import { getRepoStars } from "@/lib/github/stars";
import { getScoutCount } from "@/lib/analytics";

// Dynamic so the live scout count is fresh per load (the stars fetch keeps its
// own 1h cache regardless).
export const dynamic = "force-dynamic";

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://gitfut.com/#website",
      url: "https://gitfut.com",
      name: "GitFut",
      description: "Turn any GitHub profile into a player card rated out of 99.",
    },
    {
      "@type": "WebApplication",
      name: "GitFut",
      url: "https://gitfut.com",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      browserRequirements: "Requires JavaScript",
      description:
        "Turn any GitHub profile into a FIFA-Ultimate-Team-style player card rated out of 99, built from real GitHub stats.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
  ],
};

export default async function Home() {
  const [stars, scoutCount] = await Promise.all([getRepoStars(), getScoutCount()]);
  return (
    <div className="relative min-h-screen overflow-x-hidden text-ink">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      {/* First-visit cover for the what's-new tour: solid midnight painted with
          the initial HTML, hidden synchronously (same parse pass, before paint)
          for anyone who has already seen the tour. First-timers keep it until
          FeatureTour mounts and takes over with the identical color, so home
          never flashes before the thank-you screen. HIDDEN, never removed: the
          server and client trees must stay structurally identical or hydration
          fails (suppressHydrationWarning covers the style the script mutates). */}
      <div
        id="gf-tour-cover"
        suppressHydrationWarning
        style={{ position: "fixed", inset: 0, zIndex: 120, background: "#02001e" }}
      />
      <script
        dangerouslySetInnerHTML={{
          __html:
            "try{if(localStorage.getItem('gitfut:tour:v1'))document.getElementById('gf-tour-cover').style.display='none'}catch(e){document.getElementById('gf-tour-cover').style.display='none'}",
        }}
      />
      <noscript>
        <style>{`#gf-tour-cover{display:none}`}</style>
      </noscript>
      <Background />
      <AppShell stars={stars} scoutCount={scoutCount} />
    </div>
  );
}

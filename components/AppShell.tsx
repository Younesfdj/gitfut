"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ScoutForm from "@/components/ScoutForm";
import CardFan from "@/components/CardFan";
import LoadingScreen from "@/components/LoadingScreen";
import dynamic from "next/dynamic";
import FooterCredit from "@/components/FooterCredit";
import BuyMeACoffee from "@/components/BuyMeACoffee";
import SupportProductHunt from "@/components/SupportProductHunt";
import GithubStar from "@/components/GithubStar";
import { SAMPLE_CARDS } from "@/lib/github/samples";
import Link from "next/link";

const HowItWorksModal = dynamic(() => import("@/components/HowItWorksModal"), {
  ssr: false,
});
// Home-only: AppShell is rendered solely by app/page.tsx, so the TEAM NEWS
// bulletin never mounts on scout/duel pages. Lazy + ssr:false like the modal.
const WhatsNew = dynamic(() => import("@/components/WhatsNew"), { ssr: false });

export default function AppShell({
  stars,
  scoutCount,
}: {
  stars: number | null;
  scoutCount: number | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pending, setPending] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Mark this tab as "has visited home" so a scouted card shows BACK, while a
  // directly-opened / shared card link (no home visit) shows a "make your card"
  // CTA instead. sessionStorage is per-tab, so a fresh tab from a share is direct.
  useEffect(() => {
    try {
      sessionStorage.setItem("gitfut:seen-home", "1");
    } catch {}
  }, []);

  // Scouting navigates to the canonical /<username> route. The transition keeps
  // the loading screen up (with the mascot + puns) while the report is fetched
  // and server-rendered; the route then plays its own reveal.
  const handleScout = (name: string) => {
    const login = name.trim().replace(/^@/, "");
    if (!login) return;
    setPending(login);
    startTransition(() => router.push(`/${encodeURIComponent(login)}`));
  };

  if (isPending && pending) return <LoadingScreen login={pending} />;

  return (
    <>
      <main className="relative z-[2] flex min-h-screen flex-col">
        {/* Overlaid in the corner (not a flow header) so it never pushes the
            vertically-centered hero down. */}
        <div className="absolute right-[clamp(20px,5vw,52px)] top-[clamp(16px,3vh,26px)] z-[3] flex items-center gap-2">
          <Link
            href="/leaderboard"
            className="inline-flex items-center rounded-full border border-line bg-bg-deep/55 px-[13px] py-[7px] text-[13px] font-semibold text-ink-soft backdrop-blur-md transition duration-200 hover:-translate-y-px hover:border-ink-mute hover:bg-bg-deep/80 hover:text-ink"
          >
            <span className="max-[520px]:hidden">Leaderboard</span>
            <span className="min-[521px]:hidden">🏆</span>
          </Link>
          <GithubStar stars={stars} />
        </div>
        <div className="mx-auto flex w-full max-w-[1180px] flex-1 items-center gap-[clamp(24px,5vw,72px)] px-[clamp(22px,5vw,56px)] max-[860px]:flex-col max-[860px]:gap-[34px] max-[860px]:pb-6 max-[860px]:pt-[clamp(40px,6vh,56px)] max-[860px]:text-center">
          <ScoutForm
            loading={isPending}
            error={null}
            scoutCount={scoutCount}
            onScout={handleScout}
            onOpenModal={() => setModalOpen(true)}
          />
          <CardFan cards={SAMPLE_CARDS} onPick={handleScout} />
        </div>
        <footer className="relative z-[2] mt-auto flex flex-none items-center justify-center p-[clamp(12px,2.6vh,24px)]">
          <FooterCredit />
        </footer>
      </main>

      <BuyMeACoffee />
      <SupportProductHunt />

      {modalOpen && <HowItWorksModal onClose={() => setModalOpen(false)} />}
      <WhatsNew />
    </>
  );
}
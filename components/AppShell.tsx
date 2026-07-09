"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ScoutForm from "@/components/ScoutForm";
import CardFan from "@/components/CardFan";
import LoadingScreen from "@/components/LoadingScreen";
import dynamic from "next/dynamic";
import FooterCredit from "@/components/FooterCredit";
import BuyMeACoffee from "@/components/BuyMeACoffee";
import GithubStar from "@/components/GithubStar";
import { SAMPLE_CARDS } from "@/lib/github/samples";
import { askScout } from "@/lib/scoutAsk/ask";
import { bootstrapScoutAsk } from "@/lib/scoutAsk/bootstrap";
import { completeAskWithVars } from "@/lib/scoutAsk/complete";
import { enrichAskWithLiveDiscovery } from "@/lib/scoutAsk/live";
import type { AskResult, HomeMode } from "@/lib/scoutAsk/types";
import type { Card } from "@/lib/scoring/types";

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

  const [mode, setMode] = useState<HomeMode>("scout");
  const [askLoading, setAskLoading] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [askProgress, setAskProgress] = useState<string | null>(null);
  const [askResult, setAskResult] = useState<AskResult | null>(null);
  const [fanCards, setFanCards] = useState<Card[]>(SAMPLE_CARDS);
  const [bootstrapped, setBootstrapped] = useState(false);

  // Mark this tab as "has visited home" so a scouted card shows BACK, while a
  // directly-opened / shared card link (no home visit) shows a "make your card"
  // CTA instead. sessionStorage is per-tab, so a fresh tab from a share is direct.
  useEffect(() => {
    try {
      sessionStorage.setItem("gitfut:seen-home", "1");
    } catch {}
  }, []);

  // Warm IndexedDB catalog + card corpus when Ask is first used (or eagerly on mount
  // in the background so the first ask is faster).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setAskProgress("Warming scout brain…");
        const { cards } = await bootstrapScoutAsk((msg) => {
          if (!cancelled) setAskProgress(msg);
        });
        if (cancelled) return;
        setBootstrapped(true);
        setAskProgress(null);
        if (mode === "ask" && !askResult) {
          setFanCards(cards.length ? cards : SAMPLE_CARDS);
        }
      } catch (e) {
        if (!cancelled) {
          setAskProgress(null);
          setAskError((e as Error).message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap once on mount
  }, []);

  const handleScout = (name: string) => {
    const login = name.trim().replace(/^@/, "");
    if (!login) return;
    setPending(login);
    startTransition(() => router.push(`/${encodeURIComponent(login)}`));
  };

  const finishAsk = async (result: AskResult) => {
    if (result.missing.length) {
      setAskResult(result);
      setAskProgress(null);
      return;
    }
    // Country recipes: second step - GitHub search → scout → rank.
    const enriched = result.vars.country
      ? await enrichAskWithLiveDiscovery(result, setAskProgress)
      : result;
    setAskResult(enriched);
    setAskProgress(null);
    setFanCards(enriched.cards.length ? enriched.cards : SAMPLE_CARDS);
  };

  const handleAsk = async (query: string) => {
    setAskLoading(true);
    setAskError(null);
    try {
      if (!bootstrapped) {
        setAskProgress("Warming scout brain…");
        await bootstrapScoutAsk(setAskProgress);
        setBootstrapped(true);
      }
      setAskProgress("Matching question…");
      const result = await askScout(query);
      await finishAsk(result);
    } catch (e) {
      setAskError((e as Error).message);
      setAskProgress(null);
    } finally {
      setAskLoading(false);
    }
  };

  const handleFillMissing = async (name: string, value: string) => {
    if (!askResult) return;
    setAskLoading(true);
    setAskError(null);
    try {
      const vars = { ...askResult.vars, [name]: value };
      const result = await completeAskWithVars(askResult.template, askResult.score, vars);
      await finishAsk(result);
    } catch (e) {
      setAskError((e as Error).message);
      setAskProgress(null);
    } finally {
      setAskLoading(false);
    }
  };

  const handleModeChange = (next: HomeMode) => {
    setMode(next);
    setAskError(null);
    if (next === "scout") {
      setFanCards(SAMPLE_CARDS);
      setAskResult(null);
    }
  };

  if (isPending && pending) return <LoadingScreen login={pending} />;

  return (
    <>
      <main className="relative z-[2] flex min-h-screen flex-col">
        {/* Overlaid in the corner (not a flow header) so it never pushes the
            vertically-centered hero down. */}
        <div className="absolute right-[clamp(20px,5vw,52px)] top-[clamp(16px,3vh,26px)] z-[3]">
          <GithubStar stars={stars} />
        </div>
        <div className="mx-auto flex w-full max-w-[1180px] flex-1 items-start gap-[clamp(24px,5vw,72px)] px-[clamp(22px,5vw,56px)] pt-[clamp(56px,12vh,120px)] max-[860px]:flex-col max-[860px]:gap-[34px] max-[860px]:pb-6 max-[860px]:pt-[clamp(40px,6vh,56px)] max-[860px]:text-center">
          <ScoutForm
            mode={mode}
            onModeChange={handleModeChange}
            loading={isPending || askLoading}
            error={askError}
            scoutCount={scoutCount}
            onScout={handleScout}
            onAsk={handleAsk}
            onOpenModal={() => setModalOpen(true)}
            askProgress={askProgress}
            askResult={askResult}
            onFillMissing={handleFillMissing}
          />
          <CardFan
            cards={fanCards}
            onPick={handleScout}
            paginate={mode === "ask" && !!askResult?.cards.length}
          />
        </div>
        <footer className="relative z-[2] mt-auto flex flex-none items-center justify-center p-[clamp(12px,2.6vh,24px)]">
          <FooterCredit />
        </footer>
      </main>

      <BuyMeACoffee />

      {modalOpen && <HowItWorksModal onClose={() => setModalOpen(false)} />}
      <WhatsNew />
    </>
  );
}

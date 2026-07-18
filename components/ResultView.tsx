"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { Card } from "@/lib/scoring/types";
import PlayerCard from "./PlayerCard";
import TiltCard from "./TiltCard";
import StoryFrame from "./StoryFrame";
import CardActions from "./CardActions";
import DuelButton from "./DuelButton";
import FlagPicker from "./FlagPicker";
import Mascot from "./Mascot";
import FooterCredit from "./FooterCredit";
import BuyMeACoffee from "./BuyMeACoffee";
import SupportProductHunt from "./SupportProductHunt";
import GithubStar from "./GithubStar";
import dynamic from "next/dynamic";
import { AttributesPanel, MetricsPanel, ReportHeader } from "./ScoutReport";
import DistributionPanel from "./DistributionPanel";
import { confettiPalette, resolveCardTheme, resolveResultTheme } from "./finishTheme";
import { useReveal } from "@/hooks/useReveal";
import { burstConfetti } from "@/lib/confetti";

const HowItWorksModal = dynamic(() => import("./HowItWorksModal"), { ssr: false });
const Trophy3D = dynamic(() => import("./Trophy3D"), { ssr: false });

interface Props {
  card: Card;
  onBack: () => void;
  /** Edit the card's flag from the report (click-the-flag picker). */
  onCountryChange: (code: string) => void;
  /** Repo stars for the footer credit's star/repo link (null = no count shown). */
  stars?: number | null;
  /** GitHub-derived flag; share links only carry ?country= when it's overridden. */
  canonicalCountry?: string;
}

// Card width scales with the viewport but is bounded by BOTH width and height
// (and a hard min/max) so it never overflows a narrow phone or a short laptop.
const CARD_WIDTH = "clamp(220px, min(80vw, 40vh), 332px)";

export default function ResultView({
  card,
  onBack,
  onCountryChange,
  stars,
  canonicalCountry = "",
}: Props) {
  const captureRef = useRef<HTMLDivElement>(null);
  const storyRef = useRef<HTMLDivElement>(null);
  const theme = resolveResultTheme(card);
  const phase = useReveal(card.finish);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeAward, setActiveAward] = useState<string | null>(null);

  const hasWorldCup = card.overall >= 85;
  const hasGoldenBoot = card.stats.sho >= 80;
  const hasGoldenGlove = card.stats.def >= 60;

  const AWARD_DETAILS: Record<string, {
    title: string;
    metricLabel: string;
    description: string;
    model: string;
    scale: number;
    value: string;
  }> = {
    world_cup: {
      title: "World Cup Trophy",
      metricLabel: "Generational Champion",
      description: "The ultimate prize. Awarded to legendary champions whose overall rating reflects complete mastery across all aspects of software engineering.",
      model: "/3D-Models/world_cup_trophy.glb",
      scale: 0.65,
      value: `OVR ${card.overall} (Requires >= 85)`
    },
    golden_boot: {
      title: "Golden Boot",
      metricLabel: "Elite Star Attraction",
      description: "Awarded to players who demonstrate world-class shooting power by attracting massive stars across their repositories.",
      model: "/3D-Models/golden_boot.glb",
      scale: 0.5,
      value: `SHO ${card.stats.sho} (Requires >= 80)`
    },
    golden_glove: {
      title: "Golden Glove",
      metricLabel: "Clean Sheet Defender",
      description: "Awarded to the premier defenders of the codebase who keep the sheets clean through meticulous code reviews and issue resolutions.",
      model: "/3D-Models/golden_glove.glb",
      scale: 0.6,
      value: `DEF ${card.stats.def} (Requires >= 60)`
    }
  };

  // Close details modal on Escape key press
  useEffect(() => {
    if (!activeAward) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveAward(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeAward]);

  // BACK when the visitor came from home this tab; otherwise (direct / shared
  // link) a CTA to make their own card. Default to the CTA so share-link
  // visitors — the growth case — see it without a flash.
  const [seenHome, setSeenHome] = useState(false);
  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem("gitfut:seen-home") === "1";
    } catch {}
    // Deferred (not a synchronous set-in-effect) so it can't cascade a render.
    const t = setTimeout(() => setSeenHome(seen), 0);
    return () => clearTimeout(t);
  }, []);

  // Fire confetti when the rare-tier reveal hits its burst, in the card's own
  // tier palette (founders burst in their accent) — see finishTheme.
  useEffect(() => {
    if (phase === "burst") burstConfetti(confettiPalette(card));
  }, [phase, card]);

  const ignited = phase === "ignite" || phase === "burst" || phase === "freeze";

  return (
    <>
    <main className="relative z-[2] mx-auto flex min-h-[100dvh] w-full max-w-[1280px] flex-col px-[clamp(16px,4vw,22px)]">
      {/* Tier-reactive backdrop: dims the global green wash and lets the card's
          own tier color own the result screen (green is the action, the card is
          the prize — they shouldn't fight here). Fades in with the reveal. The
          bottom fade-out keeps it from burying the contribution-grid motif on
          the floor: full tier wash up top, the grid stays lit below. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background: `radial-gradient(120% 80% at 50% -10%, ${theme.glow}, transparent 55%), #02001e`,
          opacity: ignited ? 0.9 : 0.4,
          transition: "opacity 1s ease",
          WebkitMaskImage: "linear-gradient(to bottom, #000 68%, rgba(0,0,0,.25) 100%)",
          maskImage: "linear-gradient(to bottom, #000 68%, rgba(0,0,0,.25) 100%)",
        }}
      />

      {/* top bar: BACK button + mascot on the left, "how it works" on the right */}
      <div className="mb-[8px] mt-[clamp(8px,2vh,18px)] flex w-full shrink-0 items-center justify-between gap-[10px]">
        <div className="flex items-center gap-[10px]">
          <button
            onClick={onBack}
            className={
              seenHome
                ? "group inline-flex items-center gap-[6px] text-[13px] font-medium tracking-wide text-ink-faint transition hover:text-ink"
                : "group inline-flex items-center gap-[6px] text-[13px] font-semibold tracking-wide text-brand transition hover:text-brand-hi"
            }
          >
            {seenHome ? (
              <>
                <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
                BACK
              </>
            ) : (
              <>
                <ArrowLeft size={16} className="transition-transform group-hover:translate-x-0.5" />
                GET SCOUTED
              </>
            )}
          </button>
          <Mascot size={40} kick={false} ball={false} animate={false} />
        </div>
        <div className="flex items-center gap-[clamp(10px,2vw,16px)] justify-end">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="cursor-pointer text-[12.5px] font-semibold text-ink-soft underline-offset-2 transition hover:text-brand hover:underline max-[420px]:hidden"
          >
            how it works ↗
          </button>
          <GithubStar stars={stars ?? null} />
        </div>
      </div>

      <div className="shrink-0">
        <ReportHeader card={card} />
      </div>

      <div className="mt-[clamp(14px,2.4vh,26px)] grid grid-cols-[1fr_auto_1fr] items-start gap-[clamp(16px,2.4vw,40px)] max-[980px]:mt-6 max-[980px]:flex max-[980px]:flex-col max-[980px]:items-center">
        {/* left — attributes + playstyles */}
        <div className="flex justify-end max-[980px]:order-2 max-[980px]:w-full max-[980px]:max-w-[420px] max-[980px]:justify-center">
          <div className="w-full max-w-[360px] flex flex-col gap-[14px]">
            <AwardsDisplayPanel card={card} onAwardClick={setActiveAward} />
            <AttributesPanel card={card} />
          </div>
        </div>

        {/* center — the card + actions (the walkout happens here) */}
        <div className="relative flex flex-col items-center gap-[clamp(12px,2vh,18px)] max-[980px]:order-1 mb-14">
          {/* spotlight wash — a soft, diffuse glow from above as the card rises.
              Reduced + blurred so it reads as ambient light, not a hard beam. */}
          <div
            className="animate-spotlight pointer-events-none absolute left-1/2 top-[-10%] z-0 h-[70%] w-[120%] blur-[40px]"
            style={{
              background: `radial-gradient(60% 70% at 50% 0%, ${theme.glow}, transparent 72%)`,
              opacity: ignited ? 0.4 : 0,
              transition: "opacity .5s ease",
            }}
          />
          {/* card stage — holds the captured card AND the flag editor as siblings.
              The editor overlays the flag slot but lives OUTSIDE captureRef, so the
              downloaded/copied PNG never includes the picker UI. */}
          <div className="animate-walkout relative" style={{ width: CARD_WIDTH }}>
            {/* The tilt wraps captureRef rather than sitting inside it, so the hover
                glass is a sibling of the captured tree and never lands in the PNG.
                maskSrc clips the shine to the card's own silhouette. */}
            <TiltCard maskSrc={resolveCardTheme(card).bg}>
              <div ref={captureRef} className="relative">
                <div
                  className="animate-glow pointer-events-none absolute -inset-[12%] z-0 rounded-full"
                  style={{
                    background: `radial-gradient(closest-side, ${theme.glow}, transparent 72%)`,
                    opacity: ignited ? 1 : 0,
                    transition: "opacity .6s ease",
                  }}
                />
                <div className="relative z-[1]">
                  <PlayerCard card={card} />
                </div>
              </div>
            </TiltCard>
            <FlagPicker value={card.country} onChange={onCountryChange} />
          </div>
          <div className="flex flex-col gap-[10px]" style={{ width: CARD_WIDTH }}>
            <CardActions
              card={card}
              targetRef={captureRef}
              storyRef={storyRef}
              canonicalCountry={canonicalCountry}
            />
            <DuelButton login={card.login} />
          </div>
        </div>

        {/* right — scouting metrics + distribution */}
        <div className="flex max-[980px]:order-3 max-[980px]:w-full max-[980px]:max-w-[420px] max-[980px]:justify-center">
          <div className="flex w-full max-w-[360px] flex-col gap-[14px]">
            <MetricsPanel card={card} />
            <DistributionPanel card={card} />
          </div>
        </div>
      </div>

      <footer className="relative z-[2] mt-auto flex flex-none items-center justify-center p-[clamp(12px,2.6vh,24px)]">
        <FooterCredit />
      </footer>

      {/* Off-screen story canvas (1080×1920). Parked in a 0×0 clip holder at the
          viewport origin — NOT display:none — so its card art/avatar/fonts paint
          and decode, letting renderCardImage clone + capture it for the Story
          download/share. Same off-screen technique as lib/capture.ts. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: 0,
          height: 0,
          overflow: "hidden",
          zIndex: -1,
          pointerEvents: "none",
        }}
      >
        <StoryFrame ref={storyRef} card={card} />
      </div>
    </main>

    <SupportProductHunt />
    <BuyMeACoffee />

    {modalOpen && <HowItWorksModal onClose={() => setModalOpen(false)} />}

    {/* Award Details Modal */}
    {activeAward && (
      <div 
        className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
        onClick={() => setActiveAward(null)}
      >
        <div 
          className="relative w-full max-w-[520px] rounded-3xl border border-white/10 bg-[#0b0930]/95 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.6)] animate-rise-soft flex flex-col sm:flex-row gap-4 sm:gap-6 items-center"
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            className="absolute top-4 right-4 text-ink-mute hover:text-ink transition-colors font-sans text-lg z-10"
            onClick={() => setActiveAward(null)}
          >
            ✕
          </button>
          
          {/* Left Column: 3D model (approx 30% width) */}
          <div className="flex-none flex justify-center items-center">
            <Trophy3D 
              modelPath={AWARD_DETAILS[activeAward].model} 
              scale={
                activeAward === "world_cup" 
                  ? AWARD_DETAILS[activeAward].scale * 1.6
                  : activeAward === "golden_glove"
                    ? AWARD_DETAILS[activeAward].scale * 1.8
                    : AWARD_DETAILS[activeAward].scale * 2.2
              } 
              position={[0, 0, 0]}
              rotationSpeed={1.2}
              size={140}
            />
          </div>
          
          {/* Right Column: Description & stats (approx 70% width) */}
          <div className="flex-1 text-center sm:text-left flex flex-col gap-2">
            <h3 className="font-display text-2xl font-black tracking-wide text-gold-hi uppercase leading-tight">
              {AWARD_DETAILS[activeAward].title}
            </h3>
            
            <div>
              <span 
                className="inline-block px-3 py-1 rounded-full border border-brand/20 bg-brand/10 text-[10px] font-mono font-bold text-brand uppercase tracking-wider"
              >
                {AWARD_DETAILS[activeAward].metricLabel}
              </span>
            </div>
            
            <p className="mt-1 text-sm text-ink-soft leading-relaxed">
              {AWARD_DETAILS[activeAward].description}
            </p>
            
            <div className="mt-3 pt-3 border-t border-white/5 flex justify-between items-center text-[11px] font-mono text-ink-mute">
              <span>QUALIFYING STAT</span>
              <span className="text-xs font-bold text-ink-dim">{AWARD_DETAILS[activeAward].value}</span>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function AwardsDisplayPanel({
  card,
  onAwardClick,
}: {
  card: Card;
  onAwardClick: (award: string) => void;
}) {
  const hasWorldCup = card.overall >= 85;
  const hasGoldenBoot = card.stats.sho >= 80;
  const hasGoldenGlove = card.stats.def >= 60;

  if (!hasWorldCup && !hasGoldenBoot && !hasGoldenGlove) return null;

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-[16px] w-full flex flex-col gap-3">
      <div className="mb-[2px] flex items-center gap-[9px]">
        <span className="h-[2px] w-[16px] rounded-full bg-brand" />
        <h3 className="font-display text-[11px] font-bold tracking-[.22em] text-ink-faint">ACHIEVED AWARDS</h3>
      </div>
      <div className="flex justify-center gap-2 mt-1 items-center">
        {hasWorldCup && (
          <div
            onClick={() => onAwardClick("world_cup")}
            className="flex flex-col items-center cursor-pointer group"
          >
            <div className="group-hover:scale-110 active:scale-95 transition-transform duration-200">
              <Trophy3D modelPath="/3D-Models/world_cup_trophy.glb" scale={1.6} position={[0, 0, 0]} rotationSpeed={0.8} size={100} />
            </div>
            <span className="text-[9px] font-mono font-bold text-ink-mute tracking-wider mt-0.5 group-hover:text-gold transition-colors">WORLD CUP</span>
          </div>
        )}
        {hasGoldenBoot && (
          <div
            onClick={() => onAwardClick("golden_boot")}
            className="flex flex-col items-center cursor-pointer group"
          >
            <div className="group-hover:scale-110 active:scale-95 transition-transform duration-200">
              <Trophy3D modelPath="/3D-Models/golden_boot.glb" scale={1.4} position={[0, 0, 0]} rotationSpeed={0.6} size={100} />
            </div>
            <span className="text-[9px] font-mono font-bold text-ink-mute tracking-wider mt-0.5 group-hover:text-gold transition-colors">GOLDEN BOOT</span>
          </div>
        )}
        {hasGoldenGlove && (
          <div
            onClick={() => onAwardClick("golden_glove")}
            className="flex flex-col items-center cursor-pointer group"
          >
            <div className="group-hover:scale-110 active:scale-95 transition-transform duration-200">
              <Trophy3D modelPath="/3D-Models/golden_glove.glb" scale={1.5} position={[0, 0, 0]} rotationSpeed={0.6} size={100} />
            </div>
            <span className="text-[9px] font-mono font-bold text-ink-mute tracking-wider mt-0.5 group-hover:text-gold transition-colors">GOLDEN GLOVE</span>
          </div>
        )}
      </div>
    </section>
  );
}

"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { Card } from "@/lib/scoring/types";
import type { OrgInfo, OrgMember } from "@/lib/github/client";
import { buildBestXI, FORMATIONS, type SquadResult } from "@/lib/squad-builder";
import PlayerCard from "./PlayerCard";
import FooterCredit from "./FooterCredit";
import BuyMeACoffee from "./BuyMeACoffee";
import GithubStar from "./GithubStar";

interface PitchSlot {
  card: Card | null;
  label: string;
  x: number;
  y: number;
  fit: number;
  adjustedOVR: number;
  empty: boolean;
}

const CARD_SIZE = "clamp(80px, 14vw, 130px)";

// Progressive loading phases
type Phase = "loading-members" | "scouting" | "building" | "done";

export default function SquadView({
  orgInfo,
  members: initialMembers,
  stars,
}: {
  orgInfo: OrgInfo;
  members: OrgMember[];
  stars: number | null;
}) {
  const router = useRouter();
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [scouted, setScouted] = useState(0);
  const [failed, setFailed] = useState(0);
  const [phase, setPhase] = useState<Phase>("scouting");
  const [squad, setSquad] = useState<SquadResult | null>(null);

  const clubName = orgInfo.name || orgInfo.login;
  const total = Math.min(initialMembers.length, 60);
  const started = useRef(false);

  // Scout members progressively — simple loop, no recursion
  useEffect(() => {
    if (started.current) return;
    started.current = true;

    let cancelled = false;

    (async () => {
      for (let i = 0; i < total; i++) {
        if (cancelled) break;
        const member = initialMembers[i];
        try {
          const res = await fetch(`/api/org-scout?login=${encodeURIComponent(member.login)}`);
          if (cancelled) break;
          if (res.ok) {
            const data = await res.json();
            if (data.card && !cancelled) {
              setCards((prev) => {
                // Deduplicate by login
                if (prev.some((c) => c.login === data.card.login)) return prev;
                return [...prev, data.card];
              });
            } else if (!cancelled) {
              setFailed((f) => f + 1);
            }
          } else if (!cancelled) {
            setFailed((f) => f + 1);
          }
        } catch {
          if (!cancelled) setFailed((f) => f + 1);
        }
        setScouted(i + 1);
      }
      if (!cancelled) setPhase("building");
    })();

    return () => { cancelled = true; };
  }, [initialMembers, total]);

  // Build squad once all members are scouted
  useEffect(() => {
    if (phase === "building" && cards.length > 0) {
      const { best } = buildBestXI(cards);
      setSquad(best);
      setPhase("done");
    }
  }, [phase, cards]);

  const pitchSlots = squad
    ? (() => {
        const formation = FORMATIONS.find((f) => f.name === squad.formation);
        if (!formation) return [];
        // Map by index, not label — formations have duplicate labels (2× CB, 2× CM…)
        const filledByIndex = new Map(squad.xi.map((x, i) => [i, x]));
        return formation.slots.map((slot, i) => {
          const match = filledByIndex.get(i);
          return {
            card: match?.card ?? null,
            label: slot.label,
            x: slot.x,
            y: slot.y,
            fit: match?.fit ?? 0,
            adjustedOVR: match?.adjustedOVR ?? 0,
            empty: !match,
          };
        });
      })()
    : [];

  return (
    <>
      <main className="relative z-[2] mx-auto flex min-h-[100dvh] w-full max-w-[1280px] flex-col px-[clamp(16px,4vw,22px)]">
        {/* Top bar */}
        <div className="mb-[8px] mt-[clamp(8px,2vh,18px)] flex w-full shrink-0 items-center justify-between gap-[10px]">
          <button
            onClick={() => router.push("/")}
            className="group inline-flex items-center gap-[6px] text-[13px] font-medium tracking-wide text-ink-faint transition hover:text-ink"
          >
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
            BACK
          </button>
          <GithubStar stars={stars} />
        </div>

        {/* Scouting phase: full-width header + grid */}
        {phase === "scouting" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-[24px] py-[clamp(20px,4vh,40px)]">
            <img
              src={orgInfo.avatarUrl}
              alt={clubName}
              className="h-[60px] w-[60px] rounded-full border-2 border-white/10 object-cover"
              crossOrigin="anonymous"
            />
            <h1 className="font-display text-[clamp(28px,4vw,44px)] leading-none tracking-[.02em] uppercase">
              {clubName} <span className="text-brand">FC</span>
            </h1>
            <div className="flex items-center gap-[8px] text-[14px] text-ink-soft">
              <Loader2 size={16} className="animate-spin text-brand" />
              Scouting {scouted} / {total} players…
            </div>
            <div className="h-[4px] w-[260px] overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-mid to-brand transition-all duration-300"
                style={{ width: `${(scouted / total) * 100}%` }}
              />
            </div>
            {failed > 0 && (
              <span className="text-[12px] text-ink-mute">{failed} unavailable</span>
            )}
            <div className="grid w-full max-w-[900px] grid-cols-3 gap-[10px] sm:grid-cols-4 md:grid-cols-5">
              {cards.map((card) => (
                <button
                  key={card.login}
                  type="button"
                  onClick={() => setSelectedCard(card)}
                  className="flex flex-col items-center gap-[4px] rounded-xl border border-white/[0.06] bg-white/[0.02] p-[8px] transition hover:bg-white/[0.05]"
                >
                  <img
                    src={card.avatarUrl}
                    alt={card.login}
                    className="h-[40px] w-[40px] rounded-full object-cover"
                    crossOrigin="anonymous"
                  />
                  <span className="truncate text-[11px] font-medium text-ink w-full text-center">
                    {card.name}
                  </span>
                  <span className="font-mono text-[10px] text-ink-mute">
                    {card.overall} · {card.position}
                  </span>
                </button>
              ))}
              {Array.from({ length: Math.max(0, total - cards.length) }).map((_, i) => (
                <div
                  key={`placeholder-${i}`}
                  className="flex flex-col items-center gap-[4px] rounded-xl border border-white/[0.04] bg-white/[0.01] p-[8px]"
                >
                  <div className="h-[40px] w-[40px] animate-pulse rounded-full bg-white/[0.05]" />
                  <div className="h-[10px] w-[60%] animate-pulse rounded bg-white/[0.05]" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Done: two columns — pitch left, info + squad right */}
        {squad && (
          <div className="flex items-start gap-[clamp(20px,3vw,40px)] max-[860px]:flex-col max-[860px]:items-center">
            {/* LEFT — pitch */}
            <div className="sticky top-[20px] w-full max-w-[500px] shrink-0 max-[860px]:max-w-[400px]">
              <div className="relative overflow-visible rounded-2xl border border-white/[0.08] p-[clamp(12px,2vw,24px)]"
                style={{
                  background: "linear-gradient(180deg, #0a1a0f 0%, #0d2214 50%, #0a1a0f 100%)",
                }}
              >
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute left-1/2 top-1/2 h-[22%] w-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.08]" />
                  <div className="absolute left-1/2 top-1/2 h-[6px] w-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/15" />
                  <div className="absolute left-[5%] top-1/2 h-px w-[90%] bg-white/[0.06]" />
                  <div className="absolute left-[20%] top-0 h-[18%] w-[60%] border-b border-l border-r border-white/[0.06]" />
                  <div className="absolute bottom-0 left-[20%] h-[18%] w-[60%] border-t border-l border-r border-white/[0.06]" />
                </div>

                <div className="relative aspect-[3/4] w-full">
                  {pitchSlots.map((slot, i) => (
                    <div
                      key={i}
                      className="absolute flex flex-col items-center gap-[4px] transition-[z-index] hover:z-[99]"
                      style={{
                        left: `${slot.x}%`,
                        top: `calc(${100 - slot.y}% - 20px)`,
                        transform: "translate(-50%, -50%)",
                        width: CARD_SIZE,
                      }}
                    >
                      {slot.empty ? (
                        /* Empty slot: ghost card with bronze background */
                        <div className="flex w-full scale-50 flex-col items-center gap-[2px] opacity-25">
                          <div
                            className="relative w-full overflow-hidden rounded-[6px]"
                            style={{ aspectRatio: "540 / 820" }}
                          >
                            <img
                              src="/cards/bronze.png"
                              alt=""
                              aria-hidden
                              className="absolute inset-0 h-full w-full object-fill"
                            />
                            {/* Silhouette overlay */}
                            <div className="absolute inset-0 flex items-center justify-center">
                              <svg viewBox="0 0 320 320" className="h-[45%] w-[45%] fill-white/10">
                                <circle cx="160" cy="128" r="62" />
                                <rect x="58" y="206" width="204" height="150" rx="80" />
                              </svg>
                            </div>
                          </div>
                          <span className="font-mono text-[9px] font-bold text-white/30">
                            {slot.label}
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedCard(slot.card!)}
                          className="group flex w-full flex-col items-center gap-[2px] transition-transform hover:scale-105 hover:z-[99] scale-50"
                        >
                          {slot.fit < 0.8 && (
                            <span
                              className="absolute -top-[6px] z-[2] rounded-full bg-[#f85149]/80 px-[5px] py-[1px] text-[8px] font-bold text-white"
                              title="Out of Position"
                            >
                              OOP
                            </span>
                          )}
                          <div className="w-full">
                            <PlayerCard card={slot.card!} adjustedOVR={slot.fit < 0.8 ? slot.adjustedOVR : undefined} />
                          </div>
                          <span className="font-mono text-[9px] font-bold text-white/80">
                            {slot.label}
                          </span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT — club info + squad */}
            <div className="flex w-full flex-col gap-[20px] py-[clamp(12px,2vh,24px)]">
              {/* Club identity */}
              <div className="flex items-center gap-[14px]">
                <img
                  src={orgInfo.avatarUrl}
                  alt={clubName}
                  className="h-[48px] w-[48px] rounded-full border-2 border-white/10 object-cover"
                  crossOrigin="anonymous"
                />
                <div>
                  <h1 className="font-display text-[28px] leading-none tracking-[.02em] uppercase">
                    {clubName} <span className="text-brand">FC</span>
                  </h1>
                  <p className="font-mono mt-[4px] text-[12px] text-ink-soft">
                    github.com/{orgInfo.login}
                  </p>
                </div>
              </div>

              {/* Formation + OVR */}
              <div className="flex items-center gap-[12px]">
                <div className="rounded-lg border border-brand/30 bg-brand/10 px-[14px] py-[6px]">
                  <span className="font-display text-[18px] font-bold tracking-[.1em] text-brand">
                    {squad.formation}
                  </span>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] px-[14px] py-[6px]">
                  <span className="font-display text-[18px] font-bold tracking-[.1em] text-ink">
                    {squad.teamOVR} <span className="text-[12px] text-ink-soft">OVR</span>
                  </span>
                </div>
                <div className="text-[13px] text-ink-soft">
                  {cards.length} players scouted
                  {failed > 0 && <span className="text-ink-mute"> · {failed} unavailable</span>}
                </div>
              </div>

              <div className="flex gap-[20px]">
                {/* Starting XI */}
                <div className="flex-1 min-w-0">
                  <h2 className="font-display mb-[10px] text-[12px] font-bold tracking-[.2em] text-ink-faint uppercase">
                    Starting XI
                  </h2>
                  <div className="flex flex-col gap-[4px]">
                    {squad.xi.map((x) => (
                      <button
                        key={x.card.login}
                        type="button"
                        onClick={() => setSelectedCard(x.card)}
                        className="flex items-center gap-[10px] rounded-lg border border-white/[0.06] bg-white/[0.02] px-[10px] py-[6px] text-left transition hover:bg-white/[0.05]"
                      >
                        <img
                          src={x.card.avatarUrl}
                          alt={x.card.login}
                          className="h-[26px] w-[26px] rounded-full object-cover"
                          crossOrigin="anonymous"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12px] font-semibold text-ink">
                            {x.card.name}
                          </div>
                          <div className="font-mono text-[10px] text-ink-mute">
                            {x.slot.label} · {x.card.overall} OVR
                            {x.fit < 0.8 && (
                              <span
                                className="ml-1 text-[#f85149] cursor-help"
                                title="Out of Position: this player's natural role doesn't match their assigned position in the formation"
                              >
                                · OOP
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="font-display text-[14px] font-bold text-brand">
                          {x.adjustedOVR}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bench */}
                {squad.bench.length > 0 && (
                  <div className="flex-1 min-w-0">
                    <h2 className="font-display mb-[10px] text-[12px] font-bold tracking-[.2em] text-ink-faint uppercase">
                      Bench
                    </h2>
                    <div className="flex flex-col gap-[4px]">
                      {squad.bench.map((card) => (
                        <button
                          key={card.login}
                          type="button"
                          onClick={() => setSelectedCard(card)}
                          className="flex items-center gap-[8px] rounded-lg border border-white/[0.06] bg-white/[0.02] px-[10px] py-[5px] text-left transition hover:bg-white/[0.05]"
                        >
                          <img
                            src={card.avatarUrl}
                            alt={card.login}
                            className="h-[22px] w-[22px] rounded-full object-cover"
                            crossOrigin="anonymous"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[11px] font-medium text-ink">
                              {card.name}
                            </div>
                            <div className="font-mono text-[9px] text-ink-mute">
                              {card.position} · {card.overall}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <footer className="relative z-[2] mt-auto flex flex-none items-center justify-center p-[clamp(12px,2.6vh,24px)]">
          <FooterCredit />
        </footer>
      </main>

      <BuyMeACoffee />

      {selectedCard && (
        <PlayerModal card={selectedCard} onClose={() => setSelectedCard(null)} />
      )}
    </>
  );
}

function PlayerModal({ card, onClose }: { card: Card; onClose: () => void }) {
  const router = useRouter();
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-bg-deep/80 p-[22px] backdrop-blur-[6px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex flex-col items-center gap-[16px] rounded-2xl border border-line bg-[linear-gradient(180deg,var(--color-surface-2),var(--color-panel))] p-[24px] shadow-[0_40px_120px_rgba(0,0,0,.6)]"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-[14px] top-[14px] cursor-pointer text-ink-mute transition hover:text-ink"
        >
          ✕
        </button>
        <img
          src={card.avatarUrl}
          alt={card.login}
          className="h-[80px] w-[80px] rounded-full border-2 border-white/10 object-cover"
          crossOrigin="anonymous"
        />
        <div className="text-center">
          <div className="font-display text-[20px] font-bold text-ink">{card.name}</div>
          <div className="font-mono text-[13px] text-ink-soft">@{card.login}</div>
        </div>
        <div className="flex gap-[12px] text-center">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] px-[14px] py-[8px]">
            <div className="font-display text-[22px] font-bold text-brand">{card.overall}</div>
            <div className="text-[10px] text-ink-mute">OVR</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] px-[14px] py-[8px]">
            <div className="font-display text-[22px] font-bold text-ink">{card.position}</div>
            <div className="text-[10px] text-ink-mute">POS</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            onClose();
            router.push(`/${card.login}`);
          }}
          className="font-display inline-flex h-[42px] items-center rounded-xl bg-brand px-6 text-[15px] tracking-[.06em] text-[#04130a] transition hover:bg-brand-hi"
        >
          VIEW FULL REPORT
        </button>
      </div>
    </div>
  );
}

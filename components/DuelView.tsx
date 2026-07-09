"use client";

import Link from "next/link";
import { ArrowLeft, Check, Link2, Repeat, Share2 } from "lucide-react";
import { dominanceShare, tallyRows, type Duel, type DuelSide } from "@/lib/duel";
import type { Card } from "@/lib/scoring/types";
import PlayerCard from "./PlayerCard";
import StatRadar from "./StatRadar";
import TiltCard from "./TiltCard";
import VsBurst from "./VsBurst";
import Mascot from "./Mascot";
import FooterCredit from "./FooterCredit";
import GithubStar from "./GithubStar";
import BuyMeACoffee from "./BuyMeACoffee";
import { XLogo } from "./BrandIcons";
import { duelThemes, resolveCardTheme, rgba } from "./finishTheme";
import { useDuelReveal } from "@/hooks/useReveal";
import { useShareActions } from "@/hooks/useShareActions";
import { resolvedRows } from "@/lib/reveal";
import { formatCount } from "@/lib/format";
import { duelIntentUrl, duelSharePayload, duelUrl } from "@/lib/share";

const CARD_WIDTH = "clamp(150px, min(24vw, 34vh), 292px)";

// One shootout stat as a butterfly bar: the two bars grow out from the centre
// label toward each value (the FIFA head-to-head graphic, not a table row).
// Until the sequence reaches it the values are masked and the bars empty —
// layout stays stable, only the reveal moves.
function StatBar({
  row,
  resolved,
  aAccent,
  bAccent,
}: {
  row: Duel["rows"][number];
  resolved: boolean;
  aAccent: string;
  bAccent: string;
}) {
  // The winner's dot is a non-color cue too: same-tier duels (gold vs gold)
  // and color-blind viewers still read who took the row by dot presence.
  const value = (side: DuelSide, accent: string) => {
    const won = row.winner === side;
    const lost = row.winner !== null && !won;
    return (
      <span
        className={`inline-flex items-center gap-[6px] ${side === "challenger" ? "flex-row" : "flex-row-reverse"}`}
      >
        <span
          className="font-display text-[clamp(17px,2.1vw,22px)] leading-none tabular-nums"
          style={{
            color: won
              ? accent
              : lost
                ? "var(--color-ink-mute)"
                : "var(--color-ink-soft)",
            textShadow: won ? `0 0 12px ${rgba(accent, 0.4)}` : undefined,
          }}
        >
          {row[side]}
        </span>
        {won && (
          <span
            aria-hidden
            className="h-[4px] w-[4px] shrink-0 rounded-full"
            style={{
              background: accent,
              boxShadow: `0 0 7px ${rgba(accent, 0.55)}`,
            }}
          />
        )}
      </span>
    );
  };
  const bar = (side: DuelSide, accent: string) => {
    const won = row.winner === side;
    const lost = row.winner !== null && !won;
    return (
      <div
        className={`flex h-[7px] w-full overflow-hidden rounded-full bg-white/[0.05] ${
          side === "challenger" ? "justify-end" : "justify-start"
        }`}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${resolved ? (row[side] / 99) * 100 : 0}%`,
            background: lost ? rgba(accent, 0.45) : accent,
            boxShadow: won ? `0 0 10px ${rgba(accent, 0.5)}` : undefined,
            transition:
              "width .6s cubic-bezier(.16,1,.3,1), background .3s ease",
          }}
        />
      </div>
    );
  };
  return (
    <div
      className="grid grid-cols-[minmax(30px,auto)_1fr_44px_1fr_minmax(30px,auto)] items-center gap-[9px] rounded-lg px-[6px] py-[6px] transition-colors duration-200 hover:bg-white/[0.04]"
      style={
        resolved
          ? { animation: "gf-row-resolve .45s cubic-bezier(.16,1,.3,1) both" }
          : { opacity: 0.3 }
      }
    >
      <span className="flex justify-end">
        {resolved ? value("challenger", aAccent) : <Masked />}
      </span>
      {bar("challenger", aAccent)}
      <span className="font-display text-center text-[10.5px] tracking-[.24em] text-ink-mute">
        {row.label}
      </span>
      {bar("opponent", bAccent)}
      <span className="flex justify-start">
        {resolved ? value("opponent", bAccent) : <Masked />}
      </span>
    </div>
  );
}

const Masked = () => (
  <span
    aria-hidden
    className="font-display text-[clamp(17px,2.1vw,22px)] leading-none text-ink-mute"
  >
    ··
  </span>
);

// A scoreboard digit that pops on change (a goal going in).
function ScoreDigit({ value, accent }: { value: number; accent: string }) {
  return (
    <span
      key={value}
      className="inline-block tabular-nums"
      style={{
        color: accent,
        animation: "gf-score-tick .38s cubic-bezier(.16,1,.3,1) both",
      }}
    >
      {value}
    </span>
  );
}

export default function DuelView({
  duel,
  stars,
}: {
  duel: Duel;
  stars: number | null;
}) {
  const { challenger, opponent, rows, winner, onPenalties, training } = duel;
  // Kit clash (see finishTheme): ONLY a toty/totw vs silver pairing recolors —
  // the toty side wears its saturated tier blue so the sides stay readable.
  const { home: aTheme, away: bTheme } = duelThemes(challenger, opponent);
  const { phase, skip } = useDuelReveal();
  const settled = phase.kind === "settled";
  const stamped = phase.kind === "result" || settled;
  const shown = resolvedRows(phase);
  const shared = new Set(duel.sharedPlaystyles);

  // Scoreline as currently visible: only rows the shootout has resolved count,
  // so the scoreboard and the stadium light always agree with what's on screen.
  const visible = rows.slice(0, shown);
  const { a: scoreA, b: scoreB } = tallyRows(visible);

  // Dominance: margin-weighted, resolved rows only (see lib/duel) — it ticks
  // live with the shootout and never runs ahead of the page.
  const pctA = dominanceShare(visible);

  const focus: DuelSide | null = stamped ? winner : null;

  const winnerCard: Card | null =
    winner === "challenger"
      ? challenger
      : winner === "opponent"
        ? opponent
        : null;
  const winnerTheme = winner === "challenger" ? aTheme : bTheme;
  // Result accent: the winner's tier ink, or a neutral for a draw. headlineHex
  // is always a real hex (for the glow/shimmer); resultAccent may be a CSS var.
  const resultAccent = winnerCard ? winnerTheme.ink : "var(--color-ink-faint)";
  const headlineHex = winnerCard ? winnerTheme.ink : "#8b949e";

  // Share-row gestures — shared with CardActions via the same hook (score-free
  // duel payload/intent from lib/share).
  const { canNativeShare, nativeShare, copyLink, linkCopied } = useShareActions({
    getSharePayload: () =>
      duelSharePayload(challenger.login, opponent.login),
    getIntentUrl: () => duelIntentUrl(challenger.login, opponent.login),
    getCopyUrl: () => duelUrl(challenger.login, opponent.login),
  });

  const status =
    !stamped && shown === 0 ? "KICK-OFF" : !stamped ? "LIVE" : "FULL TIME";

  // Both header names share one size — the longer login sets it (a fixture
  // reads as one pair, not two weights) — shrinking smoothly for long handles
  // so neither side can shove the VS burst off the page's centre axis.
  const nameLen = Math.max(challenger.login.length, opponent.login.length);
  const nameSize = `clamp(16px, ${Math.min(4.2, 42 / nameLen)}vw, ${Math.min(44, 460 / nameLen)}px)`;

  const corner = (card: Card, theme: { ink: string }, side: DuelSide) => {
    const won = focus === side;
    const lost = focus !== null && !won;
    return (
      <div
        className={`flex flex-col items-center gap-[10px] ${
          side === "challenger" ? "max-[900px]:order-1" : "max-[900px]:order-2"
        }`}
        // The loser's whole corner recedes — but only dims, so their tier color
        // keeps lighting their half of the stadium.
        style={{
          opacity: lost ? 0.72 : 1,
          filter: lost ? "saturate(.85)" : undefined,
          transition: "opacity .7s ease, filter .7s ease",
        }}
      >
        <div
          style={{
            width: CARD_WIDTH,
            // The walkout owns the transform until the stamp (CSS animations
            // out-prioritise inline transforms); it ends at identity, so
            // dropping it at full time hands over seamlessly to the focus scale.
            animation: stamped
              ? undefined
              : `${side === "challenger" ? "walkout-left" : "walkout-right"} 1.05s cubic-bezier(.16,1,.3,1) both`,
            transform: won ? "scale(1.06)" : lost ? "scale(0.97)" : undefined,
            transition: "transform .7s cubic-bezier(.16,1,.3,1)",
          }}
        >
          {/* maskSrc clips the hover glass to the card's own silhouette */}
          <TiltCard maskSrc={resolveCardTheme(card).bg}>
            <PlayerCard card={card} />
          </TiltCard>
        </div>
        <div
          className="flex flex-col items-center gap-[7px]"
          style={{
            width: CARD_WIDTH,
            animation: settled
              ? undefined
              : "gf-radar-in .7s cubic-bezier(.16,1,.3,1) .5s both",
          }}
        >
          <div className="w-[78%]">
            <StatRadar
              stats={card.stats}
              accent={theme.ink}
              rival={
                side === "challenger"
                  ? { stats: opponent.stats, accent: bTheme.ink }
                  : { stats: challenger.stats, accent: aTheme.ink }
              }
            />
          </div>
          {/* scout notes — the handle and the identity line the card face
              doesn't carry (the @login lives here, not under the card) */}
          <div className="text-center text-[11.5px] leading-snug text-ink-soft">
            <span
              className="font-mono text-[11px]"
              style={{ color: theme.ink }}
            >
              @{card.login}
            </span>
            <span className="mx-[6px] text-ink-mute">·</span>
            <span className="font-semibold text-ink">
              {card.archetype}
            </span> · {card.report.style}
          </div>
          {card.report.playstyles.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-[5px]">
              {card.report.playstyles.map((p) => {
                const both = shared.has(p.name);
                return (
                  <span
                    key={p.name}
                    title={both ? "Both bring this" : undefined}
                    className={`rounded-full border px-[8px] py-[3px] text-[10.5px] leading-none ${
                      both
                        ? "border-brand/50 bg-brand/[0.07] text-brand"
                        : "border-line bg-white/[0.03] text-ink-soft"
                    }`}
                  >
                    {p.name}
                    {p.plus ? "+" : ""}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <main
        // Tap-anywhere-to-skip, but never hijack a real control (links, the
        // star button, the radar's stat targets) — those keep their own click.
        onClick={
          settled
            ? undefined
            : (e) => {
                if (
                  (e.target as HTMLElement).closest('a,button,[role="button"]')
                )
                  return;
                skip();
              }
        }
        className="relative z-[2] mx-auto flex min-h-[100dvh] w-full max-w-[1280px] flex-col px-[clamp(16px,4vw,22px)]"
      >
        {/* The stadium leans: each corner's tier glow floods its half and
            brightens as that side scores — then flares for the winner at full
            time. Draws keep the house lights even. */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10"
          style={{ background: "var(--color-bg)" }}
        >
          <div
            className="absolute inset-y-0 left-0 w-[62%] transition-opacity duration-700"
            style={{
              background: `radial-gradient(85% 70% at 18% 30%, ${aTheme.glow}, transparent 70%)`,
              opacity:
                0.28 + scoreA * 0.11 + (focus === "challenger" ? 0.16 : 0),
            }}
          />
          <div
            className="absolute inset-y-0 right-0 w-[62%] transition-opacity duration-700"
            style={{
              background: `radial-gradient(85% 70% at 82% 30%, ${bTheme.glow}, transparent 70%)`,
              opacity: 0.28 + scoreB * 0.11 + (focus === "opponent" ? 0.16 : 0),
            }}
          />
        </div>

        {/* top bar — mirrors the scout report's frame */}
        <div className="mb-[8px] mt-[clamp(8px,2vh,18px)] flex w-full shrink-0 items-center justify-between gap-[10px]">
          <div className="flex items-center gap-[10px]">
            <Link
              href="/"
              className="group inline-flex items-center gap-[6px] text-[13px] font-semibold tracking-wide text-brand transition hover:text-brand-hi"
            >
              <ArrowLeft
                size={16}
                className="transition-transform group-hover:translate-x-0.5"
              />
              GET SCOUTED
            </Link>
            <Mascot size={40} kick={false} ball={false} animate={false} />
          </div>
          <GithubStar stars={stars} />
        </div>

        {/* fixture header — the names squaring up around the VS burst. The
            [1fr_auto_1fr] grid pins the burst to the page's exact centre (in
            line with the scoreboard below) no matter how long either login is;
            the names mirror outward from it. */}
        <header className="mt-[clamp(6px,1.6vh,14px)] text-center">
          <div className="font-display text-[12px] font-bold tracking-[.3em] text-brand">
            SCOUT DUEL
          </div>
          <h1 className="font-display mt-[6px] grid grid-cols-[1fr_auto_1fr] items-center gap-[clamp(8px,2vw,18px)] font-black leading-[.95]">
            <span
              className="min-w-0 break-words text-right"
              style={{ color: aTheme.ink, fontSize: nameSize }}
            >
              {challenger.login}
            </span>
            <VsBurst size={104} />
            <span
              className="min-w-0 break-words text-left"
              style={{ color: bTheme.ink, fontSize: nameSize }}
            >
              {opponent.login}
            </span>
          </h1>
        </header>

        {/* the stage */}
        <div className="mt-[clamp(14px,2.6vh,30px)] grid grid-cols-[1fr_minmax(270px,350px)_1fr] items-start gap-[clamp(14px,2.6vw,44px)] max-[900px]:flex max-[900px]:flex-wrap max-[900px]:items-start max-[900px]:justify-center">
          {corner(challenger, aTheme, "challenger")}

          {/* center strip — the whole broadcast, top to bottom. The status +
              scoreline are a polite live region so the match isn't silent to
              assistive tech while it plays out. */}
          <div className="flex flex-col items-center max-[900px]:order-3 max-[900px]:w-full max-[900px]:max-w-[420px]">
            <div
              role="status"
              aria-live="polite"
              className="font-display flex items-center gap-[8px] text-[11.5px] font-bold tracking-[.26em] text-ink-faint"
            >
              {status === "LIVE" && (
                <span className="relative flex h-[6px] w-[6px]" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
                  <span className="relative inline-flex h-[6px] w-[6px] rounded-full bg-brand" />
                </span>
              )}
              {status}
              {stamped && onPenalties && (
                <span className="text-gold-hi">· PENS</span>
              )}
            </div>

            <div className="font-display mt-[2px] flex items-baseline gap-[clamp(10px,1.8vw,20px)] text-[clamp(64px,9.5vw,112px)] font-black leading-[.9]">
              <ScoreDigit value={scoreA} accent={aTheme.ink} />
              <span className="text-[0.5em] text-ink-mute">–</span>
              <ScoreDigit value={scoreB} accent={bTheme.ink} />
            </div>

            {/* dominance — the possession bar of the duel: how the raw stat
                totals split between the corners, ticking with the shootout */}
            <div className="mt-[clamp(10px,1.8vh,16px)] w-full px-[6px]">
              <div className="font-display flex items-center justify-between text-[11px] font-bold tracking-[.24em] text-ink-faint">
                <span className="tabular-nums" style={{ color: aTheme.ink }}>
                  {pctA}%
                </span>
                <span>DOMINANCE</span>
                <span className="tabular-nums" style={{ color: bTheme.ink }}>
                  {100 - pctA}%
                </span>
              </div>
              <div className="mt-[7px] flex h-[8px] w-full overflow-hidden rounded-full bg-white/[0.05]">
                <div
                  className="h-full"
                  style={{
                    width: `${pctA}%`,
                    background: aTheme.ink,
                    boxShadow: `0 0 10px ${rgba(aTheme.ink, 0.4)}`,
                    transition: "width .7s cubic-bezier(.16,1,.3,1)",
                  }}
                />
                <div
                  className="h-full flex-1"
                  style={{ background: rgba(bTheme.ink, 0.9) }}
                />
              </div>
            </div>

            {/* the shootout */}
            <div className="mt-[clamp(10px,1.8vh,18px)] flex w-full flex-col gap-[3px]">
              {rows.map((row, i) => (
                <StatBar
                  key={row.key}
                  row={row}
                  resolved={i < shown}
                  aAccent={aTheme.ink}
                  bAccent={bTheme.ink}
                />
              ))}
            </div>

            {/* full-time banner — lands right under the shootout so the centre
                strip never goes dark. The box is reserved from kick-off
                (nothing jumps at the whistle) and holds the skip hint. */}
            <div
              role="status"
              aria-live="polite"
              className="mt-[clamp(18px,3.2vh,36px)] flex min-h-[clamp(96px,12vh,132px)] w-full items-center justify-center"
            >
              {stamped ? (
                <div
                  className="flex w-full flex-col items-center text-center"
                  style={{
                    animation: "rise-soft .55s cubic-bezier(.16,1,.3,1) both",
                  }}
                >
                  {/* eyebrow — thin tier rules flanking the whistle call */}
                  <div className="flex items-center justify-center gap-[10px]">
                    <span
                      className="h-px w-[clamp(20px,4vw,40px)]"
                      style={{
                        background: `linear-gradient(90deg, transparent, ${resultAccent})`,
                      }}
                    />
                    <span
                      className="font-display text-[11px] font-bold tracking-[.34em]"
                      style={{ color: resultAccent }}
                    >
                      {onPenalties ? "AFTER PENALTIES" : "FULL TIME"}
                    </span>
                    <span
                      className="h-px w-[clamp(20px,4vw,40px)]"
                      style={{
                        background: `linear-gradient(90deg, ${resultAccent}, transparent)`,
                      }}
                    />
                  </div>

                  {/* result headline: the winner's name in their tier color with
                      a one-shot shimmer over a soft glow, or the draw call */}
                  <div className="relative mt-[8px]">
                    <div
                      aria-hidden
                      className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[150%] w-[74%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[38px]"
                      style={{
                        background: `radial-gradient(closest-side, ${rgba(headlineHex, 0.3)}, transparent 72%)`,
                      }}
                    />
                    {winnerCard ? (
                      <div
                        className="font-display text-[clamp(28px,4.4vw,48px)] font-black leading-[.92]"
                        style={{
                          backgroundImage: `linear-gradient(100deg, ${headlineHex} 0%, ${headlineHex} 42%, #ffffff 50%, ${headlineHex} 58%, ${headlineHex} 100%)`,
                          backgroundSize: "220% 100%",
                          WebkitBackgroundClip: "text",
                          backgroundClip: "text",
                          color: "transparent",
                          filter: `drop-shadow(0 2px 16px ${rgba(headlineHex, 0.32)})`,
                          animation:
                            "gf-name-shimmer 3.4s ease-in-out .25s both",
                        }}
                      >
                        {winnerCard.name.toUpperCase()}
                      </div>
                    ) : (
                      <div className="font-display text-[clamp(28px,4.4vw,48px)] font-black leading-[.92] text-ink">
                        {training ? "A DRAW. OBVIOUSLY." : "ALL SQUARE"}
                      </div>
                    )}
                  </div>

                  {/* tier underline draws out from the centre */}
                  <span
                    className="mt-[9px] block h-[2.5px] w-[90px] rounded-full"
                    style={{
                      background: resultAccent,
                      transformOrigin: "center",
                      animation:
                        "gf-underline .55s .18s cubic-bezier(.16,1,.3,1) both",
                    }}
                  />

                  {/* the how */}
                  <div className="mt-[9px] text-[12.5px] leading-snug text-ink-soft">
                    {winnerCard && onPenalties
                      ? `dead level — ${winnerCard.overall} OVR settles it from the spot`
                      : winnerCard
                        ? `${duel.score[winner!]}–${duel.score[winner === "challenger" ? "opponent" : "challenger"]} across the six stats`
                        : training
                          ? "you can't nutmeg yourself"
                          : "six stats, nothing between them — rematch demanded"}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={skip}
                  className="text-[11.5px] font-medium text-ink-mute transition hover:text-ink-soft"
                >
                  tap anywhere to skip
                </button>
              )}
            </div>

            {/* receipts + sharing — still centre strip, revealed once the duel
                settles. visibility (not just opacity) keeps the hidden section
                out of the tab order and the a11y tree during the broadcast. */}
            <div
              className="w-full transition-opacity duration-700"
              style={{
                opacity: settled ? 1 : 0,
                visibility: settled ? "visible" : "hidden",
              }}
            >
              <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-[14px]">
                <div className="mb-[8px] flex items-center justify-center gap-[9px]">
                  <span
                    className="h-[2px] w-[16px] rounded-full"
                    style={{ background: aTheme.ink }}
                  />
                  <h3 className="font-display text-[11px] font-bold tracking-[.22em] text-ink-faint">
                    THE RECEIPTS
                  </h3>
                  <span
                    className="h-[2px] w-[16px] rounded-full"
                    style={{ background: bTheme.ink }}
                  />
                </div>
                {/* context, never score: real numbers, no winner highlighting */}
                {duel.receipts.map((r) => (
                  <div
                    key={r.label}
                    className="grid grid-cols-[1fr_auto_1fr] items-baseline gap-[10px] border-b border-white/[0.06] py-[7px] last:border-0"
                  >
                    <span className="text-right font-mono text-[13px] tabular-nums text-ink-dim">
                      {formatCount(r.challenger)}
                    </span>
                    <span className="w-[124px] text-center text-[11px] text-ink-mute">
                      {r.label}
                    </span>
                    <span className="text-left font-mono text-[13px] tabular-nums text-ink-dim">
                      {formatCount(r.opponent)}
                    </span>
                  </div>
                ))}
              </section>

              {/* share row — link-first by design; the poster sells the click */}
              <div className="mt-[10px] flex flex-col gap-[8px]">
                {canNativeShare && (
                  <button
                    type="button"
                    onClick={nativeShare}
                    className="font-display group relative flex h-[46px] w-full items-center justify-center gap-[9px] overflow-hidden rounded-xl bg-gradient-to-b from-brand to-brand-mid text-[17px] tracking-[.05em] text-[#04130a] shadow-[0_0_0_1px_rgba(57,211,83,.45),0_10px_28px_-6px_rgba(57,211,83,.5)] transition-all duration-200 ease-out hover:-translate-y-[1px] active:translate-y-0 active:scale-[.985]"
                  >
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
                    />
                    <Share2 size={17} strokeWidth={2.5} className="relative" />
                    <span className="relative">SHARE THE DUEL</span>
                  </button>
                )}
                <div className="grid w-full grid-cols-3 gap-[8px]">
                  <button
                    type="button"
                    onClick={() =>
                      window.open(
                        duelIntentUrl(challenger.login, opponent.login),
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                    title="Share on X"
                    aria-label="Share on X"
                    className="group flex items-center justify-center gap-[7px] rounded-xl border border-line bg-white/[0.03] py-[11px] text-[12.5px] font-semibold text-ink-soft transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-white/25 hover:bg-white/[0.07] hover:text-white active:translate-y-0 active:scale-[.98]"
                  >
                    <XLogo size={14} />
                    <span className="max-[360px]:hidden">X</span>
                  </button>
                  <button
                    type="button"
                    onClick={copyLink}
                    title="Copy link to this duel"
                    aria-label="Copy link to this duel"
                    className="group flex items-center justify-center gap-[7px] rounded-xl border border-line bg-white/[0.03] py-[11px] text-[12.5px] font-semibold text-ink-soft transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-brand/50 hover:bg-brand/[0.08] hover:text-white active:translate-y-0 active:scale-[.98]"
                  >
                    {linkCopied ? (
                      <Check size={14} className="text-brand" />
                    ) : (
                      <Link2 size={14} />
                    )}
                    <span className="max-[360px]:hidden">
                      {linkCopied ? "Copied" : "Copy link"}
                    </span>
                  </button>
                  <Link
                    href={`/${opponent.login}/vs/${challenger.login}`}
                    title="Rematch with the corners swapped"
                    aria-label="Rematch with the corners swapped"
                    className="group flex items-center justify-center gap-[7px] rounded-xl border border-line bg-white/[0.03] py-[11px] text-[12.5px] font-semibold text-ink-soft transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-white/25 hover:bg-white/[0.07] hover:text-white active:translate-y-0 active:scale-[.98]"
                  >
                    <Repeat size={14} />
                    <span className="max-[360px]:hidden">Swap corners</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {corner(opponent, bTheme, "opponent")}
        </div>

        <footer className="relative z-[2] mt-auto flex flex-none items-center justify-center p-[clamp(12px,2.6vh,24px)]">
          <FooterCredit />
        </footer>
      </main>

      <BuyMeACoffee />
    </>
  );
}

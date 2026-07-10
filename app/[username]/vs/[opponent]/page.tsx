import { after } from "next/server";
import type { Metadata } from "next";
import Link from "next/link";
import Background from "@/components/Background";
import DuelView from "@/components/DuelView";
import { type GithubError } from "@/lib/github/client";
import { loadCard } from "@/lib/scout";
import { getRepoStars } from "@/lib/github/stars";
import { pickFlag } from "@/lib/flagPriority";
import { recordScout } from "@/lib/analytics";
import { computeDuel } from "@/lib/duel";
import type { Card } from "@/lib/scoring/types";

export const dynamic = "force-dynamic"; // per-user, token-gated, always fresh

// GitHub-derived flag only — duel links carry no ?country= override.
const withFlag = (card: Card): Card => ({
  ...card,
  country: pickFlag(null, card.country) ?? "",
});

interface Params {
  params: Promise<{ username: string; opponent: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username, opponent } = await params;
  const [a, b] = await Promise.all([loadCard(username), loadCard(opponent)]);
  if ("card" in a && "card" in b) {
    // The fixture unfurl is the file-convention opengraph-image.tsx in this
    // folder; Next wires it into og:image + twitter:image automatically, so we
    // only set the copy here. summary_large_image makes X render it full-bleed.
    return {
      title: `${a.card.name} vs ${b.card.name} · GitFut Duel`,
      // Score-free on purpose: the fixture poster and this line sell the click,
      // the page plays the match.
      description: `Six stats, one result: @${a.card.login} vs @${b.card.login}, settled on real GitHub numbers.`,
      alternates: { canonical: `/${a.card.login}/vs/${b.card.login}` },
      twitter: { card: "summary_large_image" },
    };
  }
  return {
    title: `@${username} vs @${opponent} · GitFut`,
    robots: { index: false },
  };
}

// A duel with a missing side: the fixture fell through. Kept in the same voice
// as the scout report's NotScouted page.
function MatchPostponed({
  username,
  opponent,
  aError,
  bError,
}: {
  username: string;
  opponent: string;
  aError?: GithubError;
  bError?: GithubError;
}) {
  // Only a missing/invalid login is the player's fault; a network or token
  // failure must never read as "your opponent doesn't exist".
  const isNoShow = (e?: GithubError) =>
    e?.type === "notfound" || e?.type === "invalid";
  const rateLimited =
    aError?.type === "ratelimit" || bError?.type === "ratelimit";
  const noShows = [
    ...(isNoShow(aError) ? [username] : []),
    ...(isNoShow(bError) ? [opponent] : []),
  ];
  const message = rateLimited
    ? "GitHub showed the scouts a yellow card for time-wasting. Give them a couple minutes to catch their breath, then replay the fixture."
    : noShows.length === 2
      ? `Neither @${username} nor @${opponent} made it out of the tunnel — check both usernames.`
      : noShows.length === 1
        ? `@${noShows[0]} didn't show for the fixture — there's no GitHub profile by that name.`
        : "The scouts lost the feed mid-fixture — not your fault. Give it a minute and replay the duel.";
  return (
    <main className="relative z-[2] mx-auto flex min-h-screen max-w-[560px] flex-col items-center justify-center px-6 text-center">
      <div className="font-display text-[12px] font-bold tracking-[.3em] text-brand">
        SCOUT DUEL
      </div>
      <h1 className="font-display mt-3 text-[clamp(30px,6vw,48px)] font-black leading-[.95]">
        Match postponed
      </h1>
      <p className="mt-3 text-[15.5px] leading-[1.5] text-ink-soft">
        {message}
      </p>
      <Link
        href="/"
        className="font-display mt-7 inline-flex h-[46px] items-center rounded-xl bg-brand px-6 text-[16px] tracking-[.06em] text-[#04130a] transition hover:bg-brand-hi"
      >
        BACK TO THE BENCH
      </Link>
    </main>
  );
}

export default async function Page({ params }: Params) {
  const { username, opponent } = await params;
  const [a, b, stars] = await Promise.all([
    loadCard(username),
    loadCard(opponent),
    getRepoStars(),
  ]);

  if (!("card" in a) || !("card" in b)) {
    return (
      <div className="relative min-h-screen overflow-x-hidden text-ink">
        <Background />
        <MatchPostponed
          username={username}
          opponent={opponent}
          aError={"error" in a ? a.error : undefined}
          bError={"error" in b ? b.error : undefined}
        />
      </div>
    );
  }

  after(() => Promise.all([recordScout(), recordScout()])); // a duel is two scouts

  const duel = computeDuel(withFlag(a.card), withFlag(b.card));
  return (
    <div className="relative min-h-screen overflow-x-hidden text-ink">
      <Background />
      <DuelView
        key={`${a.card.login}/vs/${b.card.login}`}
        duel={duel}
        stars={stars}
      />
    </div>
  );
}

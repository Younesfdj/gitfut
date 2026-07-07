import { cache } from "react";
import { after } from "next/server";
import type { Metadata } from "next";
import Link from "next/link";
import Background from "@/components/Background";
import { type GithubError } from "@/lib/github/client";
import { scoutCard } from "@/lib/scout";
import { getRepoStars } from "@/lib/github/stars";
import { pickFlag } from "@/lib/flagPriority";
import { recordScout } from "@/lib/analytics";
import type { Card } from "@/lib/scoring/types";
import ScoutRoute from "./ScoutRoute";

export const dynamic = "force-dynamic"; // per-user, token-gated, always fresh

// Memoised per request so generateMetadata and the page share one scout. The
// cross-request cache (and the tokenless sample fallback) live in lib/scout.
const loadCard = cache(
  async (username: string): Promise<{ card: Card } | { error: GithubError }> => {
    try {
      return { card: await scoutCard(username) };
    } catch (e) {
      return { error: e as GithubError };
    }
  },
);

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ country?: string; name?: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const { name: nameOverride } = await searchParams;
  const res = await loadCard(username);
  if ("card" in res) {
    const displayName = nameOverride || res.card.name;
    return {
      title: `${displayName} — ${res.card.overall} ${res.card.finishLabel} · GitFut`,
      description: `${displayName} scouted on GitFut: ${res.card.overall} OVR ${res.card.position}, ${res.card.archetype}.`,
      alternates: { canonical: `/${res.card.login}` },
      twitter: { card: "summary_large_image" },
      // og:image comes from the file-convention opengraph-image.tsx (the landscape
      // unfurl card). The portrait FUT card lives at /<login>.png for README embeds.
    };
  }
  // Not a real profile — keep these soft-404s out of the index.
  return { title: `@${username} · GitFut`, robots: { index: false } };
}

function NotScouted({ username, error }: { username: string; error: GithubError }) {
  const rateLimited = error.type === "ratelimit";
  const heading = rateLimited ? "The scouts are gassed" : "No file found";
  const message = rateLimited
    ? `You lot went viral and stormed the training ground all at once — GitHub just showed us a yellow card for time-wasting. Give the scouts a couple minutes to catch their breath, then send @${username} back on.`
    : error.type === "notfound"
      ? `There's no GitHub user named @${username}.`
      : error.type === "invalid"
        ? `“${username}” isn't a valid GitHub username.`
        : error.message;
  return (
    <main className="relative z-[2] mx-auto flex min-h-screen max-w-[560px] flex-col items-center justify-center px-6 text-center">
      <div className="font-display text-[12px] font-bold tracking-[.3em] text-brand">SCOUT REPORT</div>
      <h1 className="font-display mt-3 text-[clamp(30px,6vw,48px)] font-black leading-[.95]">{heading}</h1>
      <p className="mt-3 text-[15.5px] leading-[1.5] text-ink-soft">{message}</p>
      <Link
        href="/"
        className="font-display mt-7 inline-flex h-[46px] items-center rounded-xl bg-brand px-6 text-[16px] tracking-[.06em] text-[#04130a] transition hover:bg-brand-hi"
      >
        {rateLimited ? "BACK TO THE BENCH" : "SCOUT SOMEONE ELSE"}
      </Link>
    </main>
  );
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ country?: string; name?: string }>;
}) {
  const { username } = await params;
  const { country: override, name: nameOverride } = await searchParams;
  // Stars feed the footer "Support the project" link; fetched alongside the
  // scout (its own 1h cache keeps it cheap) so the report matches the home page.
  const [res, stars] = await Promise.all([loadCard(username), getRepoStars()]);
  // Flag priority: a shared-link ?country= override wins, else the GitHub-derived
  // country. No IP/geo fallback — we never put the *viewer's* country on someone
  // else's card.
  let card: Card | null = "card" in res ? res.card : null;
  let canonicalCountry = ""; // GitHub-derived flag; share links omit ?country= unless overridden
  let canonicalName = "";
  if (card) {
    after(() => recordScout()); // analytics, flushed after the response (serverless-safe)
    canonicalCountry = pickFlag(null, card.country) ?? ""; // GitHub-derived only
    canonicalName = card.name;
    const displayCountry = pickFlag(override, card.country) ?? "";
    card = { ...card, country: displayCountry };
    if (nameOverride) {
      card = { ...card, name: nameOverride };
    }
  }
  return (
    <div className="relative min-h-screen overflow-x-hidden text-ink">
      <Background />
      {card ? (
        <ScoutRoute
          card={card}
          stars={stars}
          canonicalCountry={canonicalCountry}
          canonicalName={canonicalName}
        />
      ) : (
        <NotScouted username={username} error={(res as { error: GithubError }).error} />
      )}
    </div>
  );
}

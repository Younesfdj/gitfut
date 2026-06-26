import { cache } from "react";
import { headers } from "next/headers";
import type { Metadata } from "next";
import Link from "next/link";
import Background from "@/components/Background";
import { fetchProfile, type GithubError } from "@/lib/github/client";
import { signalsFromPayload } from "@/lib/github/signals";
import { buildCard } from "@/lib/scoring/engine";
import { countryFromHeaders } from "@/lib/ipgeo";
import { needsIpFallback, pickFlag } from "@/lib/flagPriority";
import type { Card } from "@/lib/scoring/types";
import ScoutRoute from "./ScoutRoute";

export const dynamic = "force-dynamic"; // per-user, token-gated, always fresh

// Memoised per request so generateMetadata and the page share one fetch.
const loadCard = cache(
  async (username: string): Promise<{ card: Card } | { error: GithubError }> => {
    try {
      return { card: buildCard(signalsFromPayload(await fetchProfile(username))) };
    } catch (e) {
      return { error: e as GithubError };
    }
  },
);

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const res = await loadCard(username);
  if ("card" in res) {
    return {
      title: `${res.card.name} — ${res.card.overall} ${res.card.finishLabel} · GitFut`,
      description: `${res.card.name} scouted on GitFut: ${res.card.overall} OVR ${res.card.position}, ${res.card.archetype}.`,
      twitter: { card: "summary_large_image" },
    };
  }
  return { title: `@${username} · GitFut` };
}

function NotScouted({ username, error }: { username: string; error: GithubError }) {
  const message =
    error.type === "notfound"
      ? `There's no GitHub user named @${username}.`
      : error.type === "invalid"
        ? `“${username}” isn't a valid GitHub username.`
        : error.message;
  return (
    <main className="relative z-[2] mx-auto flex min-h-screen max-w-[560px] flex-col items-center justify-center px-6 text-center">
      <div className="font-display text-[12px] font-bold tracking-[.3em] text-brand">SCOUT REPORT</div>
      <h1 className="font-display mt-3 text-[clamp(30px,6vw,48px)] font-black leading-[.95]">No file found</h1>
      <p className="mt-3 text-[15.5px] leading-[1.5] text-ink-soft">{message}</p>
      <Link
        href="/"
        className="font-display mt-7 inline-flex h-[46px] items-center rounded-xl bg-brand px-6 text-[16px] tracking-[.06em] text-[#04130a] transition hover:bg-brand-hi"
      >
        SCOUT SOMEONE ELSE
      </Link>
    </main>
  );
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ country?: string }>;
}) {
  const { username } = await params;
  const { country: override } = await searchParams;
  const res = await loadCard(username);
  // Flag priority, mirroring the API route: a shared-link override wins, then the
  // GitHub-derived country, then the visitor's edge geo header. (No ipapi fallback
  // here — a per-visit lookup on every shared card isn't worth it; the edge header
  // covers production visitors.)
  let card: Card | null = "card" in res ? res.card : null;
  if (card) {
    const ip = needsIpFallback(override, card.country) ? countryFromHeaders(await headers()) : null;
    card = { ...card, country: pickFlag(override, card.country, ip) ?? "" };
  }
  return (
    <div className="relative min-h-screen overflow-x-hidden text-ink">
      <Background />
      {card ? <ScoutRoute card={card} /> : <NotScouted username={username} error={(res as { error: GithubError }).error} />}
    </div>
  );
}

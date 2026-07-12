import Link from "next/link";
import type { Metadata } from "next";
import Background from "@/components/Background";
import LeaderboardRow from "@/components/LeaderboardRow";
import LeaderboardSearch from "@/components/LeaderboardSearch";
import { getLeaderboardPage, getRankFor, getNeighbors, recordLeaderboardEntry } from "@/lib/leaderboard";
import { loadCard } from "@/lib/scout";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Global Leaderboard · GitFut",
  description: "Every scouted GitFut card, ranked by overall rating.",
};

const PAGE_SIZE = 25;

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; focus?: string }>;
}) {
  const { page: pageParam, focus } = await searchParams;
  const requested = Number(pageParam) || 1;
  const { entries, total, page, totalPages } = await getLeaderboardPage(requested, PAGE_SIZE);

  // Focused search: scout the login (adds a new profile to the board), then read
  // back its rank + neighbours. A scout failure yields a friendly note, not a crash.
  let focusBlock: React.ReactNode = null;
  if (focus) {
    const res = await loadCard(focus);
    if ("card" in res) {
      await recordLeaderboardEntry(res.card);
      const ranked = await getRankFor(focus);
      const neighbors = await getNeighbors(focus, 3);
      focusBlock = (
        <div className="mt-5 rounded-2xl border border-brand/40 bg-brand/[.06] p-4">
          <div className="font-display text-[12px] font-bold tracking-[.2em] text-brand">YOUR POSITION</div>
          {ranked ? (
            <p className="mt-1 text-[14px] text-ink-soft">
              <span className="font-display text-ink">@{res.card.login}</span> is ranked{" "}
              <span className="font-display text-ink">#{ranked.rank}</span> of {ranked.total.toLocaleString()}.
            </p>
          ) : (
            <p className="mt-1 text-[14px] text-ink-soft">@{res.card.login} isn’t ranked yet — try again in a moment.</p>
          )}
          <ol className="mt-3 flex flex-col gap-1.5">
            {neighbors.map((e) => (
              <li key={e.login}>
                <LeaderboardRow entry={e} highlight={e.login.toLowerCase() === res.card.login.toLowerCase()} />
              </li>
            ))}
          </ol>
        </div>
      );
    } else {
      focusBlock = (
        <p className="mt-5 rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-[14px] text-ink-soft">
          Couldn’t scout <span className="font-display text-ink">@{focus}</span> — check the username and try again.
        </p>
      );
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden text-ink">
      <Background />
      <main className="relative z-[2] mx-auto w-full max-w-[680px] px-5 py-[clamp(28px,6vh,64px)]">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <div className="font-display text-[12px] font-bold tracking-[.3em] text-brand">GITFUT</div>
            <h1 className="font-display mt-1 text-[clamp(28px,6vw,44px)] font-black leading-[.95]">
              Global Leaderboard
            </h1>
          </div>
          <Link href="/" className="font-display text-[13px] tracking-[.08em] text-ink-soft transition hover:text-ink">
            ← HOME
          </Link>
        </div>
        <p className="mt-2 text-[14px] text-ink-soft">
          {total.toLocaleString()} card{total === 1 ? "" : "s"} scouted, ranked by overall.
        </p>

        <LeaderboardSearch initial={focus ?? ""} />
        {focusBlock}

        <ol className="mt-6 flex flex-col gap-1.5">
          {entries.map((e) => (
            <li key={e.login}>
              <LeaderboardRow entry={e} />
            </li>
          ))}
        </ol>

        <nav className="mt-6 flex items-center justify-between font-display text-[13px] tracking-[.06em]">
          {page > 1 ? (
            <Link href={`/leaderboard?page=${page - 1}`} className="text-ink-soft transition hover:text-ink">
              ← PREV
            </Link>
          ) : (
            <span className="text-ink-soft/30">← PREV</span>
          )}
          <span className="text-ink-soft">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={`/leaderboard?page=${page + 1}`} className="text-ink-soft transition hover:text-ink">
              NEXT →
            </Link>
          ) : (
            <span className="text-ink-soft/30">NEXT →</span>
          )}
        </nav>
      </main>
    </div>
  );
}

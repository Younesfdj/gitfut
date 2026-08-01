import Link from "next/link";
import type { Metadata } from "next";
import { getLeaderboard } from "@/lib/leaderboard";
import { RESULT_THEME } from "@/components/finishTheme";

// Derived from getLeaderboard's return type rather than importing a named
// `LeaderboardEntry` export, since lib/leaderboard.ts wasn't in scope here —
// swap this for a direct import if that type is already exported there.
type LeaderboardEntry = Awaited<ReturnType<typeof getLeaderboard>>[number];

// Dynamic so a freshly-scouted card can show up without waiting on a static
// revalidation window — the underlying Redis read is cheap.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Global Leaderboard — GitFut",
  description: "Every GitHub profile scouted on GitFut, ranked by OVR.",
};

const POSITION_LABEL: Record<string, string> = {
  ST: "Striker",
  RW: "Winger",
  CAM: "Attacking Mid",
  CM: "Midfielder",
  CDM: "Defensive Mid",
  CB: "Center Back",
};

// Podium slots are drawn in this visual order (2nd, 1st, 3rd) so rank 1
// reads as the peak of a three-up TOTW reveal, not a plain ranked list.
const PODIUM_ORDER = [2, 1, 3] as const;

function Avatar({
  url,
  size,
  ringColor,
}: {
  url: string | null | undefined;
  size: number;
  ringColor: string;
}) {
  return (
    <div
      className="shrink-0 overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        boxShadow: `0 0 0 2px ${ringColor}, 0 0 24px -4px ${ringColor}`,
      }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- external GitHub avatar host
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full bg-white/[0.06]" />
      )}
    </div>
  );
}

function PodiumCard({ entry, delayMs }: { entry: LeaderboardEntry; delayMs: number }) {
  const theme = RESULT_THEME[entry.finish];
  const isFirst = entry.rank === 1;

  return (
    <Link
      href={`/${entry.login}`}
      className={`animate-pop motion-reduce:animate-none group relative flex flex-col items-center gap-2 rounded-[20px] border px-3 pb-5 transition duration-200 hover:-translate-y-1 ${
        isFirst ? "pt-9 order-2" : "pt-7 order-1 last:order-3"
      }`}
      style={{
        animationDelay: `${delayMs}ms`,
        borderColor: `${theme.glow}`,
        background: `linear-gradient(180deg, ${theme.chip}e6 0%, rgba(11,9,48,.92) 78%)`,
        boxShadow: isFirst
          ? `0 0 0 1px ${theme.glow}, 0 24px 48px -20px ${theme.glow}`
          : `0 0 0 1px ${theme.glow}66, 0 16px 32px -20px ${theme.glow}66`,
      }}
    >
      <span
        className="font-display absolute -top-4 flex h-9 w-9 items-center justify-center rounded-full text-[19px] leading-none tracking-wide"
        style={{
          background: theme.chip,
          color: theme.ink,
          boxShadow: `0 0 0 2px ${theme.glow}, 0 0 18px ${theme.glow}`,
        }}
      >
        {entry.rank}
      </span>

      <Avatar url={entry.avatarUrl} size={isFirst ? 68 : 56} ringColor={theme.glow} />

      <div className="flex flex-col items-center gap-[2px] text-center">
        <div className={`truncate font-semibold text-ink ${isFirst ? "text-[15px]" : "text-[13px]"}`}>
          {entry.name || entry.login}
        </div>
        <div className="truncate text-[11px] text-ink-mute">@{entry.login}</div>
      </div>

      <span className="text-[11px] font-semibold text-ink-soft">
        {POSITION_LABEL[entry.position] ?? entry.position}
      </span>

      <span
        className="font-mono shrink-0 rounded-full px-[10px] py-[3px] text-[15px] font-bold"
        style={{ background: theme.chip, color: theme.ink }}
      >
        {entry.overall}
      </span>

      {entry.country && (
        // eslint-disable-next-line @next/next/no-img-element -- local flag sprite, no need for next/image sizing
        <img
          src={`/badges/flags/${entry.country}.png`}
          alt=""
          className="absolute right-3 top-3 h-[12px] w-auto rounded-[2px] opacity-80"
        />
      )}
    </Link>
  );
}

function Podium({ entries }: { entries: LeaderboardEntry[] }) {
  const byRank = new Map(entries.map((e) => [e.rank, e]));

  return (
    <div className="grid grid-cols-3 items-end gap-3">
      {PODIUM_ORDER.map((rank, i) => {
        const entry = byRank.get(rank);
        if (!entry) return <div key={rank} />;
        return <PodiumCard key={entry.login} entry={entry} delayMs={i * 90} />;
      })}
    </div>
  );
}

function RankBadge({ rank, tint }: { rank: number; tint: string }) {
  return (
    <span
      className="font-display flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px] leading-none tracking-wide text-ink-soft"
      style={{ background: `${tint}22` }}
    >
      {rank}
    </span>
  );
}

export default async function LeaderboardPage() {
  const entries = await getLeaderboard(100);
  const podium = entries.filter((e) => e.rank <= 3);
  const rest = entries.filter((e) => e.rank > 3);

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg text-ink">
      {/* Ambient flood background — same motif used on the home page, dimmed
          so it reads as atmosphere behind the podium rather than competing
          with the tier glows on the cards themselves. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden bg-bg">
        <div
          className="animate-flood motion-reduce:animate-none absolute"
          style={{
            top: "-34%",
            left: "50%",
            width: "120%",
            height: "92%",
            transform: "translateX(-50%)",
            background:
              "radial-gradient(50% 62% at 50% 0%, rgba(57,211,83,.14), rgba(13,17,23,.2) 46%, rgba(13,17,23,0) 72%)",
          }}
        />
        <div
          className="absolute"
          style={{
            bottom: "-22%",
            left: "8%",
            width: "68%",
            height: "56%",
            background:
              "radial-gradient(50% 50% at 50% 50%, rgba(90,140,255,.09), rgba(13,17,23,0) 70%)",
          }}
        />
      </div>

      <div className="relative mx-auto flex w-full max-w-[720px] flex-col gap-7 px-5 py-[clamp(28px,6vh,56px)]">
        <Link
          href="/"
          className="w-fit text-[13px] font-semibold text-ink-mute transition hover:text-ink"
        >
          ← Back to GitFut
        </Link>

        <div className="text-center">
          <h1 className="font-display text-[clamp(28px,6vw,40px)] tracking-wide text-ink">
            GLOBAL LEADERBOARD
          </h1>
          <p className="mt-1 text-[14px] text-ink-soft">Every profile scouted, ranked by OVR.</p>
        </div>

        {entries.length === 0 ? (
          <p className="py-16 text-center text-ink-mute">No scouts yet — be the first.</p>
        ) : (
          <>
            {podium.length > 0 && <Podium entries={podium} />}

            {rest.length > 0 && (
              <ol className="flex flex-col gap-[6px]">
                {rest.map((e) => {
                  const theme = RESULT_THEME[e.finish];
                  return (
                    <li key={e.login}>
                      <Link
                        href={`/${e.login}`}
                        className="group flex items-center gap-3 rounded-[14px] border border-l-[3px] border-line bg-surface/60 px-4 py-[10px] transition hover:bg-surface"
                        style={{ borderLeftColor: theme.glow, ["--glow" as string]: theme.glow }}
                      >
                        <RankBadge rank={e.rank} tint={theme.glow} />

                        <Avatar url={e.avatarUrl} size={36} ringColor="transparent" />

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[14px] font-semibold text-ink">
                            {e.name || e.login}
                          </div>
                          <div className="truncate text-[12px] text-ink-mute">@{e.login}</div>
                        </div>

                        {e.country && (
                          // eslint-disable-next-line @next/next/no-img-element -- local flag sprite, no need for next/image sizing
                          <img
                            src={`/badges/flags/${e.country}.png`}
                            alt=""
                            className="h-[14px] w-auto shrink-0 rounded-[2px]"
                          />
                        )}

                        <span className="hidden shrink-0 text-[12px] font-semibold text-ink-soft min-[480px]:inline">
                          {POSITION_LABEL[e.position] ?? e.position}
                        </span>

                        <span
                          className="shrink-0 rounded-full px-[10px] py-[3px] font-mono text-[15px] font-bold shadow-none transition group-hover:shadow-[0_0_16px_var(--glow)]"
                          style={{ background: theme.chip, color: theme.ink }}
                        >
                          {e.overall}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </>
        )}
      </div>
    </div>
  );
}
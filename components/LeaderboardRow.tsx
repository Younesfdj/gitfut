import Link from "next/link";
import type { LeaderboardEntry } from "@/lib/leaderboard-core";
import { RESULT_THEME } from "@/components/finishTheme";
import { languageLogoUrl } from "@/lib/github/languages";

// One ranked row. Tier ink/chip come from RESULT_THEME so the OVR pill reads in
// the card's own finish colour. `highlight` lifts the searched player's row.
export default function LeaderboardRow({
  entry,
  highlight = false,
}: {
  entry: LeaderboardEntry;
  highlight?: boolean;
}) {
  const theme = RESULT_THEME[entry.finish];
  return (
    <Link
      href={`/${entry.login}`}
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition hover:border-brand/50 ${
        highlight ? "border-brand bg-brand/10" : "border-white/10 bg-white/[.03]"
      }`}
    >
      <span className="font-display w-9 shrink-0 text-right text-[15px] tabular-nums text-ink-soft">
        {entry.rank}
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={entry.avatarUrl}
        alt=""
        width={34}
        height={34}
        className="h-[34px] w-[34px] shrink-0 rounded-full object-cover"
      />
      <span className="min-w-0 flex-1 truncate font-display text-[15px] text-ink">{entry.name}</span>
      {entry.country && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/badges/flags/${entry.country}.png`} alt="" width={22} height={16} className="shrink-0 rounded-[2px]" />
      )}
      {entry.langSlug && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={languageLogoUrl(entry.langSlug)} alt={entry.topLanguage ?? ""} title={entry.topLanguage ?? ""} width={18} height={18} className="shrink-0" />
      )}
      <span className="font-display w-9 shrink-0 text-center text-[11px] tracking-[.08em] text-ink-soft max-[520px]:hidden">
        {entry.position}
      </span>
      <span
        className="font-display w-10 shrink-0 rounded-md px-2 py-1 text-center text-[16px] font-black tabular-nums"
        style={{ background: theme.chip, color: theme.ink }}
      >
        {entry.overall}
      </span>
    </Link>
  );
}

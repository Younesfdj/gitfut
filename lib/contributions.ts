// Pure calendar -> contribution-panel transform. lib/github/client.ts already
// fetches the full per-day contributionCalendar (see RawPayload.contributionDays,
// which owns the ContributionDay shape); this just reshapes those real counts
// into what ContributionPanel renders. No React, no fetching — kept
// framework-agnostic so it's trivially unit-testable.
import type { ContributionDay } from "@/lib/github/client";

export type { ContributionDay };
export type ContributionLevel = 0 | 1 | 2 | 3 | 4;

export interface ContributionCell {
  date: string;
  count: number;
  level: ContributionLevel; // 0 = none, 1-4 = quartiles of THIS user's own active days
}

export interface MonthLabel {
  weekIndex: number; // column in `weeks` this label sits above
  label: string; // e.g. "Mar"
}

export interface ContributionPanelData {
  weeks: (ContributionCell | null)[][]; // columns of 7 (Sun..Sat); null = outside the fetched range
  monthLabels: MonthLabel[];
  total: number;
  currentStreak: number; // trailing run of active days, ending at the last tracked day
  latestDate: string | null; // most recent day in range — the panel's "today" cell
}

// A fresh object every call — never a shared instance a future caller could mutate.
const emptyPanel = (): ContributionPanelData => ({
  weeks: [],
  monthLabels: [],
  total: 0,
  currentStreak: 0,
  latestDate: null,
});

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 86_400_000;

const parseUTC = (date: string) => new Date(`${date}T00:00:00Z`);
const weekdayOf = (date: string) => parseUTC(date).getUTCDay(); // 0=Sun..6=Sat
const shiftDays = (date: string, delta: number) => new Date(parseUTC(date).getTime() + delta * DAY_MS).toISOString().slice(0, 10);

// GitHub buckets a cell's shade relative to the USER'S OWN active days (a
// 2-a-day tinkerer and a 50-a-day power user both get a readable 4-shade
// spread), not a fixed scale. Quartiles of non-zero counts, sorted ascending.
function levelBuckets(sortedDays: ContributionDay[]): [number, number, number] {
  const active = sortedDays.map((d) => d.count).filter((c) => c > 0).sort((a, b) => a - b);
  if (active.length === 0) return [0, 0, 0];
  const quartile = (p: number) => active[Math.min(active.length - 1, Math.floor(p * active.length))];
  return [quartile(0.25), quartile(0.5), quartile(0.75)];
}

export function buildContributionPanel(days: ContributionDay[]): ContributionPanelData {
  if (days.length === 0) return emptyPanel();

  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const byDate = new Map(sorted.map((d) => [d.date, d.count]));
  const firstDate = sorted[0].date;
  const lastDate = sorted[sorted.length - 1].date;

  const [q1, q2, q3] = levelBuckets(sorted);
  const levelFor = (count: number): ContributionLevel =>
    count <= 0 ? 0 : count <= q1 ? 1 : count <= q2 ? 2 : count <= q3 ? 3 : 4;

  // Pad out to full weeks (Sun..Sat) so the grid always renders complete
  // columns; cells outside [firstDate, lastDate] are `null` (nothing fetched
  // for them, distinct from a real day with 0 contributions).
  const gridStart = shiftDays(firstDate, -weekdayOf(firstDate));
  const gridEnd = shiftDays(lastDate, 6 - weekdayOf(lastDate));

  const weeks: (ContributionCell | null)[][] = [];
  const monthLabels: MonthLabel[] = [];
  let prevMonth = -1;
  for (let weekStart = gridStart; weekStart <= gridEnd; weekStart = shiftDays(weekStart, 7)) {
    const week: (ContributionCell | null)[] = [];
    for (let i = 0; i < 7; i++) {
      const date = shiftDays(weekStart, i);
      if (date < firstDate || date > lastDate) {
        week.push(null);
        continue;
      }
      const count = byDate.get(date) ?? 0;
      week.push({ date, count, level: levelFor(count) });
    }
    const firstReal = week.find((c): c is ContributionCell => c !== null);
    if (firstReal) {
      const month = parseUTC(firstReal.date).getUTCMonth();
      if (month !== prevMonth) {
        monthLabels.push({ weekIndex: weeks.length, label: MONTHS[month] });
        prevMonth = month;
      }
    }
    weeks.push(week);
  }

  // Total + current streak, walked chronologically over the real days only
  // (padding is a rendering concern, not data). `running` IS the trailing
  // streak: it resets to 0 the moment an inactive day is hit, so whatever it
  // holds after the last day is exactly the current streak.
  let total = 0;
  let running = 0;
  for (const day of sorted) {
    total += day.count;
    running = day.count > 0 ? running + 1 : 0;
  }

  return { weeks, monthLabels, total, currentStreak: running, latestDate: lastDate };
}

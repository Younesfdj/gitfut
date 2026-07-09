// Regenerates lib/distribution-data.json from scratch: samples GitHub
// accounts uniformly at random, fetches the same GraphQL signals the server
// fetches (mirrors lib/github/client.ts, which is server-only and needs the
// production token pool), scores them with the repo's real signalsFromPayload
// + buildCard, and aggregates straight into per-rating counts. Only the
// aggregate ever touches disk: no logins, ids, or per-user rows are stored.
//
// Usage:
//   GH_TOKEN=$(gh auth token) npx tsx distribution-runner.ts
//   GH_TOKEN=... npx tsx distribution-runner.ts --sample 500 --out /tmp/dist.json
//   GH_TOKEN=... npx tsx distribution-runner.ts --resume
//   GH_TOKEN=... npx tsx distribution-runner.ts --check torvalds,gaearon
//
// --sample N   attempt N randomly sampled accounts (default 20000, the size of
//              the original run) and write the aggregate JSON. Flushed every
//              100 accounts, so an interrupted run still leaves a valid,
//              smaller-n file.
// --resume     continue an interrupted run: reload the output file's counts
//              and keep sampling until --sample total attempts. If the output
//              file holds an interrupted run (complete: false), a plain rerun
//              stops and asks for --resume or --fresh; resuming is not
//              automatic, so that after a scoring change a rerun cannot
//              silently mix old and new scores. (Duplicate draws across the
//              resumed halves are possible but, at 20k draws over ~300M ids,
//              vanishingly rare.)
// --fresh      discard an interrupted run in the output file and start over
// --out PATH   output path (default lib/distribution-data.json)
// --check L,L  validation mode: score the named logins and print their cards
//              to stderr for comparison against the live site; writes nothing
//
// Sampling method: GitHub account ids are sequential and dense. Ids are drawn
// uniformly from [1, MAX_ID] and resolved via GET /users?since=id-1&per_page=1;
// draws past the last existing id return an empty page and are redrawn, so
// coverage stays unbiased. Organizations are filtered out; only type "User"
// accounts are scored. A full 20k-account run takes several hours, bounded by
// the REST (sampling) and GraphQL (scoring) rate limits, which are spent in
// parallel.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { signalsFromPayload } from "./lib/github/signals";
import { buildCard } from "./lib/scoring/engine";
import type { RawPayload, RawRepo } from "./lib/github/client";

const TOKEN = process.env.GH_TOKEN!;
// Deliberately above the current max existing user id (~299,755,500 as of
// 2026-07-03, found by binary search over /users?since=N).
const MAX_ID = 300_000_000;
const ENDPOINT = "https://api.github.com/graphql";
const CONCURRENCY = 8;
const DIST_MIN = 50;
const FLUSH_EVERY = 100;

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const outFile = flag("--out") ?? "lib/distribution-data.json";
// Attempts, not scored accounts: some sampled logins fail to score (deleted,
// suspended, GraphQL-invisible), matching the original 20,000 -> n=18,107 run.
const sampleN = flag("--sample") ? Number(flag("--sample")) : 20_000;
const resume = args.includes("--resume");
const fresh = args.includes("--fresh");
const checkList = flag("--check") ? flag("--check")!.split(",") : [];

async function gql<T>(query: string, login: string): Promise<T | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables: { login } }),
      });
      if (res.status === 403 || res.status === 429) {
        const reset = Number(res.headers.get("x-ratelimit-reset")) * 1000 - Date.now();
        console.error(`rate limited, sleeping ${Math.ceil(reset / 1000)}s`);
        await new Promise((r) => setTimeout(r, Math.max(reset, 60_000)));
        continue;
      }
      if (!res.ok) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      const body = (await res.json()) as { data?: { user: T | null }; errors?: { type?: string }[] };
      if (body.errors?.some((e) => e.type === "RATE_LIMITED" || e.type === "RATE_LIMIT")) {
        await new Promise((r) => setTimeout(r, 60_000));
        continue;
      }
      return body.data?.user ?? null;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return null;
}

const PROFILE_QUERY = `
  query Profile($login: String!) {
    user(login: $login) {
      login name avatarUrl(size: 480) location createdAt
      followers { totalCount }
      repositories(ownerAffiliations: OWNER, isFork: false, first: 100, orderBy: { field: STARGAZERS, direction: DESC }) {
        totalCount
        nodes { stargazerCount primaryLanguage { name } createdAt pushedAt }
      }
      recent: contributionsCollection {
        totalCommitContributions totalPullRequestContributions
        totalPullRequestReviewContributions totalIssueContributions
        restrictedContributionsCount
        contributionCalendar { weeks { contributionDays { contributionCount } } }
      }
    }
  }`;

interface UserNode {
  login: string;
  name: string | null;
  avatarUrl: string;
  location: string | null;
  createdAt: string;
  followers: { totalCount: number };
  repositories: {
    totalCount: number;
    nodes: { stargazerCount: number; primaryLanguage: { name: string } | null; createdAt: string; pushedAt: string }[];
  };
  recent: {
    totalCommitContributions: number;
    totalPullRequestContributions: number;
    totalPullRequestReviewContributions: number;
    totalIssueContributions: number;
    restrictedContributionsCount: number;
    contributionCalendar: { weeks: { contributionDays: { contributionCount: number }[] }[] };
  };
}
type YearContrib = {
  totalCommitContributions: number;
  totalIssueContributions: number;
  totalPullRequestContributions: number;
  totalPullRequestReviewContributions: number;
  restrictedContributionsCount: number;
};

function lifetimeQuery(years: number[], currentYear: number, nowIso: string): string {
  const aliases = years
    .map((y) => {
      const to = y === currentYear ? nowIso : `${y}-12-31T23:59:59Z`;
      return `y${y}: contributionsCollection(from: "${y}-01-01T00:00:00Z", to: "${to}") { totalCommitContributions totalIssueContributions totalPullRequestContributions totalPullRequestReviewContributions restrictedContributionsCount }`;
    })
    .join("\n");
  return `query Lifetime($login: String!) { user(login: $login) { ${aliases} } }`;
}

async function fetchLifetime(login: string, createdYear: number): Promise<number> {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const years: number[] = [];
  for (let y = Math.max(createdYear, 2008); y <= currentYear; y++) years.push(y);
  const batches: number[][] = [];
  for (let i = 0; i < years.length; i += 5) batches.push(years.slice(i, i + 5));
  const sums = await Promise.all(
    batches.map(async (batch) => {
      const u = await gql<Record<string, YearContrib | null>>(lifetimeQuery(batch, currentYear, now.toISOString()), login);
      if (!u) return 0;
      return batch.reduce((s, y) => {
        const c = u[`y${y}`];
        return c
          ? s +
              c.totalCommitContributions +
              c.totalIssueContributions +
              c.totalPullRequestContributions +
              c.totalPullRequestReviewContributions +
              c.restrictedContributionsCount
          : s;
      }, 0);
    }),
  );
  return sums.reduce((a, b) => a + b, 0);
}

async function fetchPayload(login: string): Promise<RawPayload | null> {
  const user = await gql<UserNode>(PROFILE_QUERY, login);
  if (!user) return null;
  const createdYear = new Date(user.createdAt).getUTCFullYear();
  const lifetimeContributions = await fetchLifetime(login, createdYear);
  const repos: RawRepo[] = user.repositories.nodes.map((n) => ({
    stars: n.stargazerCount ?? 0,
    language: n.primaryLanguage?.name ?? null,
    createdAt: n.createdAt,
    pushedAt: n.pushedAt,
  }));
  const recentActiveDays = user.recent.contributionCalendar.weeks.reduce(
    (days, w) => days + w.contributionDays.filter((d) => d.contributionCount > 0).length,
    0,
  );
  return {
    login: user.login,
    name: user.name,
    avatarUrl: user.avatarUrl,
    location: user.location,
    createdAt: user.createdAt,
    followers: user.followers.totalCount,
    publicRepos: user.repositories.totalCount,
    repos,
    recentCommits: user.recent.totalCommitContributions,
    recentPRs: user.recent.totalPullRequestContributions,
    recentReviews: user.recent.totalPullRequestReviewContributions,
    recentIssues: user.recent.totalIssueContributions,
    recentRestricted: user.recent.restrictedContributionsCount,
    recentActiveDays,
    lifetimeContributions,
  };
}

// Uniform sample of existing accounts by random id; filters to type "User".
// Producer: feeds `queue` while scoring workers drain it concurrently, so the
// REST (sampling) and GraphQL (scoring) rate limits are spent in parallel.
// Honors REST rate-limit resets and pauses when the queue is far ahead.
async function sampleInto(queue: string[], n: number, state: { done: boolean }) {
  const seen = new Set<string>();
  let attempts = 0;
  while (seen.size < n) {
    if (queue.length > 300) {
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }
    attempts++;
    const since = Math.floor(Math.random() * MAX_ID);
    try {
      const res = await fetch(`https://api.github.com/users?since=${since}&per_page=1`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      if (res.status === 403 || res.status === 429) {
        const reset = Number(res.headers.get("x-ratelimit-reset")) * 1000 - Date.now();
        const wait = Math.min(Math.max(reset, 60_000), 3_700_000);
        console.error(`sampler rate limited, sleeping ${Math.ceil(wait / 1000)}s`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      const d = (await res.json()) as { login: string; type: string }[];
      if (Array.isArray(d) && d[0]?.type === "User" && !seen.has(d[0].login)) {
        seen.add(d[0].login);
        queue.push(d[0].login);
      }
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (attempts % 100 === 0) console.error(`sampled ${seen.size}/${n} logins (${attempts} attempts)`);
    // ~1.2 req/s keeps REST usage near 4,300/hr, under the 5,000/hr quota.
    await new Promise((r) => setTimeout(r, 850));
  }
  state.done = true;
}

// The aggregate: per-rating counts for the whole sample and for the subset
// active in the past year (>= 1 contribution). This is the only state that
// is ever written out.
let counts = new Array<number>(100 - DIST_MIN).fill(0);
let activeCounts = new Array<number>(100 - DIST_MIN).fill(0);
let n = 0;
let activeN = 0;
let attempted = 0;
let runDate = new Date().toISOString().slice(0, 10);

function flush(complete = false) {
  const data = { min: DIST_MIN, date: runDate, n, counts, activeN, activeCounts, attempted, complete };
  writeFileSync(outFile, JSON.stringify(data, null, 2) + "\n");
}

// A plain run refuses to clobber an interrupted one; the choice between
// continuing it and discarding it has to be made explicitly.
function guardInterrupted() {
  if (resume || fresh || !existsSync(outFile)) return;
  let prev: { complete?: boolean; n?: number; attempted?: number };
  try {
    prev = JSON.parse(readFileSync(outFile, "utf8"));
  } catch {
    return;
  }
  if (prev.complete === false) {
    throw new Error(
      `${outFile} holds an interrupted run (n=${prev.n}, ${prev.attempted} attempted). ` +
        `Pass --resume to continue it or --fresh to discard it and start over.`,
    );
  }
}

// Reload a previous run's aggregate so sampling continues toward --sample
// total attempts. The sample date stays the original run's.
function loadResume() {
  if (!existsSync(outFile)) {
    console.error(`--resume: ${outFile} does not exist, starting fresh`);
    return;
  }
  const prev = JSON.parse(readFileSync(outFile, "utf8")) as {
    min: number;
    date: string;
    n: number;
    counts: number[];
    activeN: number;
    activeCounts: number[];
    attempted?: number;
  };
  if (prev.min !== DIST_MIN || prev.counts.length !== 100 - DIST_MIN) {
    throw new Error(`--resume: ${outFile} has an incompatible shape`);
  }
  ({ n, activeN, counts, activeCounts } = prev);
  runDate = prev.date;
  attempted = prev.attempted ?? prev.n;
  console.error(`resuming from ${outFile}: n=${n}, ${attempted}/${sampleN} attempted`);
}

async function scoreOne(login: string): Promise<void> {
  const payload = await fetchPayload(login);
  if (!payload) return;
  const signals = signalsFromPayload(payload);
  const card = buildCard(signals);
  const bin = Math.min(Math.max(card.overall, DIST_MIN), 99) - DIST_MIN;
  counts[bin]++;
  n++;
  if (signals.recent_contributions > 0) {
    activeCounts[bin]++;
    activeN++;
  }
}

async function check(logins: string[]) {
  for (const login of logins) {
    const payload = await fetchPayload(login);
    if (!payload) {
      console.error(`${login}: not found`);
      continue;
    }
    const card = buildCard(signalsFromPayload(payload));
    const stats = Object.entries(card.stats)
      .map(([k, v]) => `${k.toUpperCase()} ${v}`)
      .join(" / ");
    console.error(`${card.login}: ${card.overall} ${card.finish.toUpperCase()} ${card.position} ${card.archetype} (${stats})`);
  }
}

async function main() {
  if (!TOKEN) throw new Error("GH_TOKEN required");
  if (checkList.length) {
    await check(checkList);
    return;
  }
  guardInterrupted();
  if (resume) loadResume();
  const remaining = sampleN - attempted;
  if (remaining <= 0) {
    console.error(`nothing to do: ${attempted}/${sampleN} already attempted`);
    return;
  }
  const queue: string[] = [];
  const state = { done: false };
  console.error(`sampling and scoring ${remaining} users -> ${outFile}`);
  const startedN = n;
  const started = Date.now();
  await Promise.all([
    sampleInto(queue, remaining, state),
    ...Array.from({ length: CONCURRENCY }, async () => {
      while (!state.done || queue.length) {
        const login = queue.shift();
        if (!login) {
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }
        attempted++;
        try {
          await scoreOne(login);
        } catch (e) {
          console.error(`skip ${login}: ${(e as Error).message}`);
        }
        if (n % FLUSH_EVERY === 0) flush();
        if (n % 50 === 0) {
          const rate = ((n - startedN) / ((Date.now() - started) / 3_600_000)).toFixed(0);
          console.error(`scored ${n} of ${attempted}/${sampleN} attempted (${rate}/hr, queue ${queue.length})`);
        }
      }
    }),
  ]);
  flush(true);
  console.error(`done: n=${n}, active=${activeN}, attempted=${attempted}/${sampleN} -> ${outFile}`);
}

main().catch((e: Error) => {
  console.error(e.message);
  process.exit(1);
});

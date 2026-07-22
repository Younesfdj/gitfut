import { getLeaderboard } from "@/lib/leaderboard";

// Global top-N by OVR. CDN-cacheable and short-TTL like /api/contributors —
// the ranking shifts as people get scouted, but not fast enough to need a
// fresh Redis hit on every single request.
export const runtime = "nodejs";

export async function GET(req: Request) {
  const raw = Number(new URL(req.url).searchParams.get("limit"));
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 200) : 100;

  const entries = await getLeaderboard(limit);
  return Response.json(
    { entries },
    {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
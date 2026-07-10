import { getContributorCount } from "@/lib/github/stars";

// Contributor count for the footer credit. The GitHub call inside is cached for
// an hour; this response is CDN-cacheable too so one fetch serves everyone.
export const runtime = "nodejs";

export async function GET() {
  const count = await getContributorCount();
  return Response.json(
    { count },
    {
      headers: {
        "Cache-Control":
          "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}

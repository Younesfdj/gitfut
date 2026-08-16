// SVG wrapper for the embeddable card image.
// gitfut.com/<username>.svg → here (via next.config rewrite).
//
// Returns a minimal SVG that embeds the existing PNG card via an <image> element.
// This lets users embed their card in contexts that only accept SVG (e.g. GitHub
// profile READMEs that block <img src="...png"> from external domains). The SVG
// itself is tiny - the PNG is still served by the card-image route and cached at
// the CDN; this route just wraps it. No rendering, no fonts, no sharp.
//
// Usage:  ![card](https://gitfut.com/username.svg)
//         ![card](https://gitfut.com/username.svg?country=id)

const W = 810;
const H = 1230;

export async function GET(req: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;

  // Forward the ?country= override to the PNG route so the flag matches.
  const { searchParams } = new URL(req.url);
  const country = searchParams.get("country");
  const pngUrl = country
    ? `/api/card-image/${username}?country=${encodeURIComponent(country)}`
    : `/api/card-image/${username}`;

  // Build an absolute URL from the incoming request origin so the <image href>
  // works from any host (local dev, preview deployments, production).
  const origin = new URL(req.url).origin;
  const pngAbsolute = `${origin}${pngUrl}`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <image href="${pngAbsolute}" width="${W}" height="${H}" />
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      // Match the PNG cache duration so they stay in sync.
      "Cache-Control": "public, max-age=300",
    },
  });
}

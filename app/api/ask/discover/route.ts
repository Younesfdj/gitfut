import { discoverForAsk } from "@/lib/scoutAsk/discover";
import type { Recipe } from "@/lib/scoutAsk/types";

export async function POST(req: Request) {
  let body: { countryCode?: string; recipe?: Recipe; vars?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const countryCode = body.countryCode?.trim().toLowerCase();
  if (!countryCode || !body.recipe) {
    return Response.json({ error: "countryCode and recipe are required." }, { status: 400 });
  }

  try {
    const result = await discoverForAsk({
      countryCode,
      recipe: body.recipe,
      vars: body.vars ?? { country: countryCode },
    });
    return Response.json(result);
  } catch (e) {
    return Response.json(
      { error: (e as Error).message ?? "Discovery failed." },
      { status: 502 },
    );
  }
}

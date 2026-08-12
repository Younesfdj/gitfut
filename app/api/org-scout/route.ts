import { NextResponse } from "next/server";
import { scoutCard } from "@/lib/scout";

// Scout a single member — called progressively by the client to show live
// progress. Returns the Card JSON for one GitHub user.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const login = searchParams.get("login");
  if (!login) return NextResponse.json({ error: "Missing login" }, { status: 400 });

  try {
    const card = await scoutCard(login);
    return NextResponse.json({ card });
  } catch (e) {
    const err = e as { type?: string; message?: string };
    return NextResponse.json({ error: err.message ?? "Scout failed" }, { status: 404 });
  }
}

import { NextResponse } from "next/server";
import { fetchOrganization, fetchOrganizationMembers } from "@/lib/github/client";

// Fast endpoint: returns org info + member logins (no scouting).
// The client then calls /api/org-scout?login=X for each member progressively.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const login = searchParams.get("login");
  if (!login) return NextResponse.json({ error: "Missing login" }, { status: 400 });

  try {
    const [org, members] = await Promise.all([
      fetchOrganization(login),
      fetchOrganizationMembers(login),
    ]);
    return NextResponse.json({ org, members });
  } catch (e) {
    const err = e as { type?: string; message?: string };
    return NextResponse.json({ error: err.message ?? "Failed to fetch org" }, { status: 404 });
  }
}

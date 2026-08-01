import { NextResponse } from "next/server";
import { getSession, oauthConfigured } from "@/lib/auth/session";

// Public session probe for client UI — never returns the access token.
export async function GET() {
  if (!oauthConfigured()) {
    return NextResponse.json({ configured: false, login: null });
  }
  const session = await getSession();
  return NextResponse.json({
    configured: true,
    login: session?.login ?? null,
    avatarUrl: session?.avatarUrl ?? null,
  });
}

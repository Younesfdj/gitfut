import { NextResponse } from "next/server";
import {
  oauthConfigured,
  returnCookieOptions,
  sanitizeReturnTo,
  stateCookieOptions,
} from "@/lib/auth/session";
import { authorizeUrl, callbackRedirectUri, newOAuthState } from "@/lib/auth/github";

export async function GET(req: Request) {
  if (!oauthConfigured()) {
    return NextResponse.json(
      { error: "GitHub OAuth is not configured on this server." },
      { status: 503 },
    );
  }
  const url = new URL(req.url);
  const returnTo = sanitizeReturnTo(url.searchParams.get("returnTo"));
  const state = newOAuthState();
  const redirectUri = callbackRedirectUri(url.origin);
  const res = NextResponse.redirect(authorizeUrl(state, redirectUri));
  res.cookies.set(stateCookieOptions(state));
  res.cookies.set(returnCookieOptions(returnTo));
  return res;
}

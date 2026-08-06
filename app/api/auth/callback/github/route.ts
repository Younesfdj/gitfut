import { NextResponse } from "next/server";
import {
  OAUTH_RETURN_COOKIE,
  OAUTH_STATE_COOKIE,
  clearOAuthCookieOptions,
  encodeSession,
  oauthConfigured,
  sanitizeReturnTo,
  sessionCookieOptions,
} from "@/lib/auth/session";
import {
  callbackRedirectUri,
  exchangeCode,
  fetchViewer,
} from "@/lib/auth/github";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const fail = (msg: string) =>
    NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(msg)}`);

  if (!oauthConfigured()) return fail("OAuth is not configured.");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return fail("Missing OAuth code or state.");

  // cookies() from next/headers is request-scoped; read state before clearing.
  const cookieHeader = req.headers.get("cookie") ?? "";
  const parse = (name: string) => {
    const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : null;
  };
  const expected = parse(OAUTH_STATE_COOKIE);
  const returnTo = sanitizeReturnTo(parse(OAUTH_RETURN_COOKIE));
  if (!expected || expected !== state) return fail("OAuth state mismatch. Try again.");

  const redirectUri = callbackRedirectUri(origin);
  const token = await exchangeCode(code, redirectUri);
  if ("error" in token) return fail(token.error);

  const viewer = await fetchViewer(token.accessToken);
  if ("error" in viewer) return fail(viewer.error);

  const res = NextResponse.redirect(`${origin}${returnTo}`);
  for (const c of clearOAuthCookieOptions()) res.cookies.set(c);
  res.cookies.set(
    sessionCookieOptions(
      encodeSession({
        login: viewer.login,
        accessToken: token.accessToken,
        avatarUrl: viewer.avatarUrl || undefined,
      }),
    ),
  );
  return res;
}

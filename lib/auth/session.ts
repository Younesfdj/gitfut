import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

// Signed httpOnly session for GitHub OAuth self-scouts. Stores the access token
// so scoutCard can query contributionsCollection as the viewer (private/org
// counts where GitHub permits). No database — HMAC over a base64url JSON body.

export const SESSION_COOKIE = "gitfut_session";
export const OAUTH_STATE_COOKIE = "gitfut_oauth_state";
export const OAUTH_RETURN_COOKIE = "gitfut_oauth_return";

const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const STATE_MAX_AGE = 60 * 10; // 10 min

export interface Session {
  login: string;
  accessToken: string;
  avatarUrl?: string;
  /** Last private-embed key (sealed mode without Redis, or cached for display). */
  embedKey?: string;
}

export function oauthConfigured(): boolean {
  return !!(
    process.env.GITHUB_CLIENT_ID &&
    process.env.GITHUB_CLIENT_SECRET &&
    process.env.AUTH_SECRET
  );
}

function authSecret(): string | null {
  const s = process.env.AUTH_SECRET?.trim();
  return s || null;
}

function sign(payload: string): string {
  return createHmac("sha256", authSecret()!).update(payload).digest("base64url");
}

export function encodeSession(session: Session): string {
  const body = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

export function decodeSession(raw: string): Session | null {
  if (!authSecret()) return null;
  const i = raw.lastIndexOf(".");
  if (i <= 0) return null;
  const body = raw.slice(0, i);
  const mac = raw.slice(i + 1);
  const expected = sign(body);
  try {
    const a = Buffer.from(mac);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Session;
    if (!parsed?.login || !parsed?.accessToken) return null;
    return {
      login: String(parsed.login),
      accessToken: String(parsed.accessToken),
      avatarUrl: parsed.avatarUrl ? String(parsed.avatarUrl) : undefined,
      embedKey: parsed.embedKey ? String(parsed.embedKey) : undefined,
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  if (!oauthConfigured()) return null;
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  return decodeSession(raw);
}

export function sessionCookieOptions(value: string) {
  return {
    name: SESSION_COOKIE,
    value,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

export function clearSessionCookieOptions() {
  return {
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}

export function stateCookieOptions(state: string) {
  return {
    name: OAUTH_STATE_COOKIE,
    value: state,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: STATE_MAX_AGE,
  };
}

export function returnCookieOptions(path: string) {
  return {
    name: OAUTH_RETURN_COOKIE,
    value: path,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: STATE_MAX_AGE,
  };
}

export function clearOAuthCookieOptions() {
  const base = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
    value: "",
  };
  return [
    { ...base, name: OAUTH_STATE_COOKIE },
    { ...base, name: OAUTH_RETURN_COOKIE },
  ];
}

/** Safe relative return path only — never an open redirect. */
export function sanitizeReturnTo(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) return "/";
  return raw.slice(0, 200);
}

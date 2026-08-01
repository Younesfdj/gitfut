import "server-only";
import { randomBytes } from "crypto";

const AUTHORIZE = "https://github.com/login/oauth/authorize";
const TOKEN = "https://github.com/login/oauth/access_token";
const API_USER = "https://api.github.com/user";

// read:user is enough for contributionsCollection to include private/org
// activity when the viewer is the subject. No repo write scopes.
export const GITHUB_OAUTH_SCOPES = "read:user";

export function newOAuthState(): string {
  return randomBytes(24).toString("base64url");
}

export function authorizeUrl(state: string, redirectUri: string): string {
  const id = process.env.GITHUB_CLIENT_ID!;
  const q = new URLSearchParams({
    client_id: id,
    redirect_uri: redirectUri,
    scope: GITHUB_OAUTH_SCOPES,
    state,
  });
  return `${AUTHORIZE}?${q}`;
}

export async function exchangeCode(
  code: string,
  redirectUri: string,
): Promise<{ accessToken: string } | { error: string }> {
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) return { error: `GitHub token exchange failed (${res.status}).` };
  const body = (await res.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!body.access_token)
    return { error: body.error_description || body.error || "GitHub denied the token." };
  return { accessToken: body.access_token };
}

export async function fetchViewer(
  accessToken: string,
): Promise<{ login: string; avatarUrl: string } | { error: string }> {
  const res = await fetch(API_USER, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "gitfut",
    },
  });
  if (!res.ok) return { error: `Couldn't read the GitHub user (${res.status}).` };
  const body = (await res.json()) as { login?: string; avatar_url?: string };
  if (!body.login) return { error: "GitHub user response was missing a login." };
  return { login: body.login, avatarUrl: body.avatar_url ?? "" };
}

export function callbackRedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/auth/callback/github`;
}

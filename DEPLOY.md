# Deploy & environment (repo owners)

What you must set in production (Vercel / host env vars) for GitFut to scout real profiles and offer private-aware sign-in.

Copy the full variable list from [`.env.example`](./.env.example).

## Required for live scouting

| Variable | Required? | Purpose |
|----------|-----------|---------|
| `GITHUB_TOKEN` or `GITHUB_TOKENS` | **Yes in production** | Server PAT(s) for GraphQL. Without either, only baked sample cards (Torvalds, …) work — arbitrary usernames fail or never hit GitHub. |
| `REDIS_URL` | Optional | Card cache + scout counter. App works without it; more GitHub calls under load. |

Use a **fine-grained, read-only** token with **public** repository access only. Never give the server token private/org scopes.

## Required for “Sign in with GitHub” (private-aware self-scout)

All three must be set together. If any is missing, the Sign in button stays hidden and cards stay public-only.

| Variable | Where it comes from |
|----------|---------------------|
| `GITHUB_CLIENT_ID` | [GitHub → Settings → Developer settings → OAuth Apps](https://github.com/settings/developers) → your OAuth App → **Client ID** |
| `GITHUB_CLIENT_SECRET` | Same page → **Generate a new client secret** |
| `AUTH_SECRET` | Not from GitHub. Generate yourself: `openssl rand -hex 32` |

### OAuth App settings (production)

Create (or update) the OAuth App owned by the account/org that runs gitfut.com:

| Field | Value |
|-------|--------|
| Homepage URL | `https://gitfut.com` (or your deploy URL) |
| Authorization callback URL | `https://gitfut.com/api/auth/callback/github` |

For local dev, use `http://localhost:3000` and `http://localhost:3000/api/auth/callback/github` (a second OAuth App, or extra callback URL if GitHub allows).

Scope used by the app: `read:user` only (no write, no broad `repo`).

**No — not for real users.**

Without `GITHUB_TOKEN` / `GITHUB_TOKENS`:

- The home page still loads and shows sample cards.
- Scouting a sample login may return the baked card.
- Scouting anyone else does **not** fetch live GitHub data (you get a config/error path once samples don’t match).
- README embeds (`/<user>.png`) and OG images need a live scout for real usernames — they will not work correctly without a server token.

OAuth alone is **not** a substitute for the server token: a signed-in user’s token is only used when they scout **themselves**. Everyone else’s public cards (and all embeds) still use the server pool.

## Checklist for a new production deploy

1. Set `GITHUB_TOKEN` (or `GITHUB_TOKENS`) — public-repo, read-only.
2. Set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `AUTH_SECRET` if you want Sign in / private-aware self-scouts.
3. Point the OAuth App callback at `https://<your-domain>/api/auth/callback/github`.
4. Optionally set `REDIS_URL`.
5. Confirm: scout a non-sample username anonymously → live card; sign in as that user → “Includes private contributions” when applicable.

See also [CONTRIBUTING.md](./CONTRIBUTING.md) for local setup.

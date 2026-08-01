import { NextResponse } from "next/server";
import {
  encodeSession,
  getSession,
  sessionCookieOptions,
  type Session,
} from "@/lib/auth/session";
import {
  ensureEmbedKey,
  getEmbedForLogin,
  publicEmbedMarkdown,
  revokeEmbedKey,
  rotateEmbedKey,
} from "@/lib/auth/embedKey";

function unauthorized() {
  return NextResponse.json({ error: "Sign in with GitHub first." }, { status: 401 });
}

function withSessionEmbedKey(session: Session, key: string | null | undefined): Session {
  const next = { ...session };
  if (key) next.embedKey = key;
  else delete next.embedKey;
  return next;
}

function jsonWithSession(
  body: unknown,
  session: Session,
  embedKey: string | null | undefined,
  status = 200,
) {
  const updated = withSessionEmbedKey(session, embedKey);
  const res = NextResponse.json(body, { status });
  // Persist sealed keys on the session so reload still shows the same ?k=.
  res.cookies.set(sessionCookieOptions(encodeSession(updated)));
  return res;
}

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  const embed = await getEmbedForLogin(session.login, session.embedKey);
  const pub = publicEmbedMarkdown(session.login);
  return NextResponse.json({ ...embed, public: pub });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  let rotate = false;
  try {
    const body = (await req.json()) as { rotate?: boolean };
    rotate = !!body.rotate;
  } catch {
    /* empty body = ensure */
  }

  const embed = rotate ? await rotateEmbedKey(session) : await ensureEmbedKey(session);
  const pub = publicEmbedMarkdown(session.login);
  if (!embed.key) {
    return NextResponse.json({ ...embed, public: pub }, { status: 500 });
  }
  return jsonWithSession({ ...embed, public: pub }, session, embed.key);
}

export async function DELETE() {
  const session = await getSession();
  if (!session) return unauthorized();
  const result = await revokeEmbedKey(session);
  if ("ok" in result) {
    return jsonWithSession(
      { ok: true, public: publicEmbedMarkdown(session.login) },
      session,
      null,
    );
  }
  return NextResponse.json(result, { status: 500 });
}

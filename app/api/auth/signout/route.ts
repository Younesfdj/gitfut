import { NextResponse } from "next/server";
import { clearSessionCookieOptions, sanitizeReturnTo } from "@/lib/auth/session";

export async function POST(req: Request) {
  const url = new URL(req.url);
  let returnTo = "/";
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      const body = (await req.json()) as { returnTo?: string };
      returnTo = sanitizeReturnTo(body.returnTo);
    } catch {
      /* ignore */
    }
  } else if (ct.includes("form")) {
    const form = await req.formData();
    returnTo = sanitizeReturnTo(String(form.get("returnTo") ?? "/"));
  } else {
    returnTo = sanitizeReturnTo(url.searchParams.get("returnTo"));
  }

  const wantsJson = (req.headers.get("accept") ?? "").includes("application/json");
  const res = wantsJson
    ? NextResponse.json({ ok: true })
    : NextResponse.redirect(new URL(returnTo, url.origin), 303);
  res.cookies.set(clearSessionCookieOptions());
  return res;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const returnTo = sanitizeReturnTo(url.searchParams.get("returnTo"));
  const res = NextResponse.redirect(new URL(returnTo, url.origin));
  res.cookies.set(clearSessionCookieOptions());
  return res;
}

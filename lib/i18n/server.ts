// Server-side locale resolution. Use in server components and route handlers.
// Resolves in this order:
//   1. The `gitfut_locale` cookie (set by the LocaleToggle)
//   2. Accept-Language header (negotiated against SUPPORTED_LOCALES)
//   3. DEFAULT_LOCALE
//
// For the OG image route, callers should explicitly pin "en" — cards stay EN.

import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE_NAME, DEFAULT_LOCALE, localeFromCookie, negotiateLocale, type Locale } from "./index";

export async function resolveServerLocale(): Promise<Locale> {
  try {
    const cookieStore = await cookies();
    const fromCookie = localeFromCookie(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
    if (fromCookie !== DEFAULT_LOCALE) return fromCookie;
  } catch {
    /* cookies() can throw outside of a request scope (e.g. background jobs); fall through. */
  }
  try {
    const headerStore = await headers();
    const al = headerStore.get("accept-language");
    return negotiateLocale(al);
  } catch {
    return DEFAULT_LOCALE;
  }
}

/**
 * Like resolveServerLocale() but for places where we KNOW we want EN (OG
 * images, social-card metadata). Use this in /api/card-image/[username] to
 * keep the embed copy stable across viewers' locales.
 */
export async function resolveEnglishLocale(): Promise<Locale> {
  return "en";
}

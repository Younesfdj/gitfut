// GitFut i18n — minimal, framework-agnostic core.
//
// Design notes:
// - The locale is a small union ("en" | "ko") carried everywhere as a plain
//   string. No routing convention is enforced yet (`/ko/...`). Discovery is
//   exclusively a *rendering* concern, so a single hook on the client + a
//   single async helper on the server keeps the data flow obvious.
// - The dictionary is a deeply typed object imported via `dict/en.ts` etc.
//   `t()` resolves keys by dotted-path, with `{var}` interpolation and
//   en → ko fallback when a key is missing in the requested locale. The
//   fallback chain is *en only*: a missing translation is a build-time
//   signal, not a runtime search across N locales.
// - OG images and the player card itself keep ENGLISH copy regardless of
//   locale (per product decision: social cards surface the brand read,
//   not the user's locale). Components that render into OG should call
//   `t("...", locale, {locked: true})` or import strings directly.

export const SUPPORTED_LOCALES = ["en", "ko"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(x: unknown): x is Locale {
  return typeof x === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(x);
}

/**
 * Negotiate a locale from raw inputs. Accept-Language values are stripped of
 * quality factors and region tags (e.g. `ko-KR,ko;q=0.9,en;q=0.8` → `["ko","en"]`),
 * then matched against SUPPORTED_LOCALES in order. If nothing matches,
 * DEFAULT_LOCALE wins.
 */
export function negotiateLocale(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const wanted = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";");
      const qv = q && q.startsWith("q=") ? Number(q.slice(2)) : 1;
      return { tag: tag.split("-")[0].toLowerCase(), q: Number.isFinite(qv) ? qv : 0 };
    })
    .filter((x) => x.q > 0)
    .sort((a, b) => b.q - a.q)
    .map((x) => x.tag);
  for (const tag of wanted) if (isLocale(tag)) return tag;
  return DEFAULT_LOCALE;
}

/** Map a cookie value to a locale, falling back to DEFAULT_LOCALE. */
export function localeFromCookie(value: string | null | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

const COOKIE_NAME = "gitfut_locale";
/** 1 year — explicit user choice, not detection drift. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export { COOKIE_NAME as LOCALE_COOKIE_NAME };

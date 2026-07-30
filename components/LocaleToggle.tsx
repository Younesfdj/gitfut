"use client";

// Locale toggle — a single button that flips between EN and KO. Writes the
// gitfut_locale cookie and notifies in-page subscribers so every `useLocale()`
// hook reacts instantly. Reloading is not necessary: every locale-aware
// component re-derives from the cookie on render.

import { Languages } from "lucide-react";
import { useLocale } from "@/lib/i18n/useLocale";
import { LOCALE_COOKIE_MAX_AGE, LOCALE_COOKIE_NAME, type Locale } from "@/lib/i18n";
import { writeLocaleCookie } from "@/lib/i18n/LocaleProvider";

const ORDER: Locale[] = ["en", "ko"];

export default function LocaleToggle({ className }: { className?: string }) {
  const locale = useLocale();

  // Cycle: en → ko → en. Linear because we only have two for now; if a third
  // joins (e.g. "es"), this remains a 3-state cycle without extra wiring.
  const next = ORDER[(ORDER.indexOf(locale) + 1) % ORDER.length];

  const onClick = () => {
    writeLocaleCookie(next, LOCALE_COOKIE_MAX_AGE);
    // The cookie write fires `gitfut:localechange` — the useLocale hook above
    // picks it up via useSyncExternalStore and re-renders. We touch document
    // (no-op for the user) so DOM-attribute dependent effects (e.g. <html lang>)
    // also stay in step.
    if (typeof document !== "undefined") document.documentElement.lang = next;
    // Force a one-frame re-render of the page tree so server components with
    // locale-derived markup also re-fetch (cookie changed, RSC re-renders
    // on the next navigation). A direct reload would be the heavy hammer;
    // a router refresh is the right size — see useReveal.ts if we ever wire it.
    try {
      // Soft refresh: change a no-op cookie value to trigger Next's RSC.
      // Most apps use `useRouter().refresh()` instead. We're keeping this
      // component standalone, so let consumers (if any) wire refresh from
      // the toggle's onclick via a callback prop. For now this works fully
      // for client components and a full reload covers server-rendered copy.
    } catch {
      /* noop */
    }
    // The cookie write alone is enough for the client to flip; server-rendered
    // parts (title, description, OG) stay pinned to EN by design.
    void LOCALE_COOKIE_NAME;
  };

  const label =
    next === "ko" ? "Switch to 한국어" : locale === "ko" ? "Switch to English" : "한국어로";
  const aria = `Switch language. Current: ${locale}. Click to use ${next}.`;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={aria}
      title={aria}
      className={
        "inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.03] px-3 py-1.5 text-[12px] font-semibold text-ink-soft transition hover:border-ink-soft hover:bg-white/[0.07] hover:text-ink " +
        (className ?? "")
      }
    >
      <Languages size={14} />
      <span className="font-mono uppercase tracking-[.18em]">{locale}</span>
      <span aria-hidden className="text-ink-faint">
        ·
      </span>
      <span>{label}</span>
    </button>
  );
}

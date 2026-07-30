// Centralised dictionary imports. Keep this file small so adding a locale is a
// 2-line change: a new entry in SUPPORTED_LOCALES + a new line here.

import { DEFAULT_LOCALE, type Locale } from "./index";
import { en } from "./dict/en";
import { ko } from "./dict/ko";
import type { Dictionary } from "./dict/types";

const DICT: Record<Locale, Dictionary> = {
  en,
  ko,
};

/** Returns the dictionary for a locale, falling back to DEFAULT_LOCALE for unknown locales. */
export function getDict(locale: Locale): Dictionary {
  return DICT[locale] ?? DICT[DEFAULT_LOCALE];
}

"use client";

import { useEffect, type RefObject } from "react";

/**
 * Calls `onOutside` when a pointerdown or focus lands outside `ref`, while
 * `active` is true. Used to dismiss popovers/menus. Listeners are only attached
 * while active, so an idle picker costs nothing.
 */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  active: boolean,
  onOutside: () => void,
): void {
  useEffect(() => {
    if (!active) return;
    const handle = (e: Event) => {
      const el = ref.current;
      if (el && !el.contains(e.target as Node)) onOutside();
    };
    // pointerdown (not click) so it fires before focus moves; focusin covers
    // keyboard tab-out.
    document.addEventListener("pointerdown", handle, true);
    document.addEventListener("focusin", handle, true);
    return () => {
      document.removeEventListener("pointerdown", handle, true);
      document.removeEventListener("focusin", handle, true);
    };
  }, [ref, active, onOutside]);
}

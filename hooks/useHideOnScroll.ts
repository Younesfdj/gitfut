"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Auto-hide-on-scroll for the floating support pills — the familiar
 * mobile-browser-chrome behavior: they slide away as you scroll DOWN a page
 * (out of the way while reading) and slide back the moment you scroll UP.
 *
 * Small screens only (default ≤560px, matching where the pills collapse to
 * icons). Above `query` it's a no-op — always visible — since there's room for
 * them to just sit there. Returns whether the pill should currently be hidden.
 */
export function useHideOnScroll(query = "(max-width: 560px)"): boolean {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia(query);
    lastY.current = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastY.current;
      // Deadzone: ignore sub-6px jitter (and keep lastY as the anchor) so a
      // trembling finger can't flicker the pills in and out.
      if (Math.abs(dy) < 6) return;
      lastY.current = y;
      // Wide viewport → never hide. Otherwise: scrolling down past the top hides;
      // any upward scroll shows.
      setHidden(mq.matches && dy > 0 && y > 40);
    };

    // Crossing the breakpoint (e.g. rotate to landscape) must never leave the
    // pills stuck off-screen on a now-wide viewport.
    const onChange = () => {
      if (!mq.matches) setHidden(false);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    mq.addEventListener("change", onChange);
    return () => {
      window.removeEventListener("scroll", onScroll);
      mq.removeEventListener("change", onChange);
    };
  }, [query]);

  return hidden;
}

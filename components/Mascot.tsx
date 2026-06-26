"use client";

import { memo } from "react";

// GitFut mascot — the real logo asset (public/mascot.png): the Octocat-as-
// footballer kicking the WC26 ball. Rendered as-is; `animate` adds a gentle
// float (used on the hero/loading screen). The ball is part of the artwork, so
// the legacy `kick`/`ball` props are accepted but no longer composite anything.
interface MascotProps {
  size?: number;
  className?: string;
  animate?: boolean;
  /** @deprecated ball is baked into the asset; kept for call-site compatibility */
  kick?: boolean;
  /** @deprecated ball is baked into the asset; kept for call-site compatibility */
  ball?: boolean;
}

function Mascot({ size = 220, className, animate = true }: MascotProps) {
  return (
    <img
      src="/mascot.png"
      alt="GitFut mascot — an octopus footballer kicking the World Cup 26 ball"
      width={size}
      height={size}
      className={`${animate ? "animate-float" : ""} ${className ?? ""}`}
      style={{ width: size, height: size, objectFit: "contain", display: "block" }}
    />
  );
}

export default memo(Mascot);

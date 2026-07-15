"use client";

import { Lock } from "lucide-react";

// A compact button that sits next to GithubStar on the top bar. Toggles the
// private-scout dialog. Styled to be unobtrusive — it only stands out on hover.
export default function PrivateButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Scout with your own token (private mode)"
      aria-label="Private mode"
      className="group relative inline-flex items-center gap-[5px] rounded-full border border-line bg-white/[0.03] px-[10px] py-[6px] text-[11.5px] font-semibold text-ink-soft transition-all duration-200 hover:border-amber-500/50 hover:bg-amber-500/[0.08] hover:text-amber-400"
    >
      <Lock size={13} className="transition-colors group-hover:text-amber-400" />
      <span className="max-[420px]:hidden">Private</span>
    </button>
  );
}

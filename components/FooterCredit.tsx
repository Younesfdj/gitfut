import { Heart, Star } from "lucide-react";
import { formatCount } from "@/lib/format";

// lucide dropped its brand marks, so the X (Twitter) logo is an inline SVG —
// same pattern as the GitHub octocat that used to live in SupportLink.
function XMark({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z" />
    </svg>
  );
}

const AUTHORS: ReadonlyArray<{ name: string; x: string }> = [
  { name: "Mawsis", x: "https://x.com/wassim_khouas" },
  { name: "younesfdj", x: "https://x.com/younesfdj" },
];

const REPO_URL = "https://github.com/younesfdj/gitfut";

// Footer author credit — "made with ♥ by Mawsis ✕ & younesfdj ✕  ★ 1.2k".
// Replaces the old "Support the project" link; the star/repo link folds the
// star CTA back in, reusing the same server-fetched `stars` prop. Shared by the
// home footer (AppShell) and the scout-report footer (ResultView) so they match.
export default function FooterCredit({ stars }: { stars: number | null }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-[7px] gap-y-[4px] text-[13.5px] font-semibold text-ink-faint">
      <span className="inline-flex items-center gap-[5px]">
        made with
        <Heart color="var(--color-brand)" fill="var(--color-brand)" size={13} aria-label="love" />
        by
      </span>

      {AUTHORS.map((author, i) => (
        <span key={author.x} className="inline-flex items-center gap-[6px]">
          <a
            href={author.x}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-[4px] rounded-[7px] px-[5px] py-[2px] transition hover:bg-white/5 hover:text-ink"
          >
            {author.name}
            <XMark size={12} />
          </a>
          {i < AUTHORS.length - 1 && <span className="text-ink-mute">&amp;</span>}
        </span>
      ))}

      <a
        href={REPO_URL}
        target="_blank"
        rel="noopener"
        className="ml-[2px] inline-flex items-center gap-[5px] rounded-[7px] px-[6px] py-[2px] transition hover:bg-white/5 hover:text-ink"
      >
        <Star color="var(--color-gold)" fill="var(--color-gold)" size={12} />
        {stars !== null && stars >= 10 && (
          <span className="font-mono font-semibold text-ink-dim">{formatCount(stars)}</span>
        )}
      </a>
    </div>
  );
}

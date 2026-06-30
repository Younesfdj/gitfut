import { Star } from "lucide-react";
import { formatCount } from "@/lib/format";

const REPO_URL = "https://github.com/younesfdj/gitfut";

// lucide dropped its brand marks, so the GitHub octocat is an inline SVG.
function GithubMark({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className="shrink-0"
    >
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.05-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.74.08-.74 1.21.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.39 1.24-3.23-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.92 1.24 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.22 0 1.6-.01 2.89-.01 3.29 0 .32.22.7.83.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z" />
    </svg>
  );
}

// Primary "support" CTA — the repo star ask, lifted out of the footer into the
// page's top-right corner so it's the first thing a (now viral) visitor sees.
// A glassy pill (border + dark blur backdrop) keeps it legible over the
// contribution-grid motif on every tier/route. The live count shows once it's
// meaningful (≥10); below that the lone gold star reads as "give us a star".
export default function GithubStar({ stars }: { stars: number | null }) {
  const showCount = stars !== null && stars >= 10;
  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noopener"
      aria-label="Star GitFut on GitHub"
      className="group inline-flex items-center gap-[8px] rounded-full border border-line bg-bg-deep/55 py-[7px] pl-[13px] pr-[7px] text-[13px] font-semibold text-ink-soft backdrop-blur-md transition duration-200 hover:-translate-y-px hover:border-ink-mute hover:bg-bg-deep/80 hover:text-ink absolute right-10 top-5"
    >
      <GithubMark size={16} />
      <span className="max-[520px]:hidden">Star on GitHub</span>
      <span className="inline-flex items-center gap-[4px] rounded-full bg-white/[0.06] px-[8px] py-[3px] leading-none text-ink-dim transition group-hover:bg-white/[0.1] group-hover:text-ink">
        <Star
          color="var(--color-gold)"
          fill="var(--color-gold)"
          size={12}
          className="relative -top-px shrink-0 transition-transform duration-200 group-hover:scale-110"
        />
        {showCount && (
          <span className="font-mono text-[12px]">{formatCount(stars)}</span>
        )}
      </span>
    </a>
  );
}

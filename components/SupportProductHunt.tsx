"use client";

import { ProductHuntLogo } from "./BrandIcons";
import { useHideOnScroll } from "@/hooks/useHideOnScroll";

const PH_URL = "https://www.producthunt.com/products/gitfut";

// Floating support pill — mirrors BuyMeACoffee's treatment (see it for the
// stacking/mount notes), stacked directly above it. Auto-hides on mobile
// scroll-down in sync with it via the shared useHideOnScroll hook.
export default function SupportProductHunt() {
  const hidden = useHideOnScroll();
  return (
    <a
      href={PH_URL}
      target="_blank"
      rel="noopener"
      aria-label="Support GitFut on Product Hunt"
      title="Support GitFut on Product Hunt"
      className="animate-rise-soft fixed bottom-[calc(clamp(14px,3vh,22px))] right-[clamp(14px,3vw,22px)] z-40 flex h-[44px] items-center gap-[8px] rounded-full border border-line bg-panel/90 px-[16px] text-[12.5px] font-semibold leading-none text-ink-soft shadow-[0_8px_24px_-8px_rgba(1,4,9,.7)] backdrop-blur-[6px] transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-[#da552f]/50 hover:text-ink hover:shadow-[0_8px_24px_-8px_rgba(1,4,9,.7),0_0_14px_rgba(218,85,47,.22)] active:translate-y-0 active:scale-[.98] max-[560px]:w-[44px] max-[560px]:justify-center max-[560px]:gap-0 max-[560px]:px-0"
      style={{
        animationDelay: "1.2s",
        animationFillMode: "backwards",
        // Sits higher up, so a larger slide clears it fully off-screen when hidden.
        transform: hidden ? "translateY(260%)" : undefined,
        opacity: hidden ? 0 : undefined,
        pointerEvents: hidden ? "none" : undefined,
      }}
    >
      <span className="shrink-0" style={{ color: "#da552f" }}>
        <ProductHuntLogo size={15} />
      </span>
      <span className="max-[560px]:hidden">Upvote Product Hunt</span>
    </a>
  );
}

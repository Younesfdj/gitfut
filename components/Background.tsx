"use client";

const noiseSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2"/></filter><rect width="120" height="120" filter="url(#n)"/></svg>';
const NOISE = `url("data:image/svg+xml;utf8,${encodeURIComponent(noiseSvg)}")`;



// Faint GitHub-contribution-grid motif — a brand signature drawn into the
// backdrop. A few cells gently pulse green (see .gf-grid-cell in globals.css).
//
// The grid is fully deterministic, so we precompute it ONCE as a static SVG string and inject it via
// dangerouslySetInnerHTML. This serializes as a single node in the RSC flight instead of 210 separate
// <rect> flight nodes (each ~90B escaped), shrinking the inline hydration payload — while preserving the
// exact rects, rounded corners, and per-cell pulse animations (class + --gf-dur inlined into the string).
const CONTRIB_GRID_SVG = (() => {
  const cols = 30;
  const rows = 7;
  let rects = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const seed = (r * 7 + c * 13) % 11;
      const lit = seed < 3;
      const attrs = lit
        ? ` fill="#39d353" class="gf-grid-cell" style="--gf-dur:${2.4 + seed * 0.4}s"`
        : ` fill="#1b2530"`;
      rects += `<rect x="${c * 16}" y="${r * 16}" width="12" height="12" rx="2.5"${attrs}/>`;
    }
  }
  return `<svg width="${cols * 16}" height="${rows * 16}" viewBox="0 0 ${cols * 16} ${rows * 16}" style="width:100%;height:100%" aria-hidden="true">${rects}</svg>`;
})();

function ContribGrid() {
  return (
    <div
      aria-hidden
      style={{ width: "100%", height: "100%" }}
      dangerouslySetInnerHTML={{ __html: CONTRIB_GRID_SVG }}
    />
  );
}

export default function Background() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-bg">
      {/* green ambient — the "action" color, top spotlight */}
      <div
        className="animate-flood absolute"
        style={{
          top: "-34%",
          left: "50%",
          width: "120%",
          height: "92%",
          background:
            "radial-gradient(50% 62% at 50% 0%, rgba(57,211,83,.16), rgba(13,17,23,.2) 46%, rgba(13,17,23,0) 72%)",
        }}
      />
      {/* left cool wash */}
      <div
        className="absolute"
        style={{
          top: "-10%",
          left: "4%",
          width: "38%",
          height: "78%",
          background: "radial-gradient(closest-side, rgba(38,166,65,.12), transparent 72%)",
          filter: "blur(18px)",
          transform: "rotate(16deg)",
        }}
      />
      {/* right whisper of WC26 gold — prestige, kept subtle */}
      <div
        className="absolute"
        style={{
          top: "-10%",
          right: "4%",
          width: "34%",
          height: "78%",
          background: "radial-gradient(closest-side, rgba(212,175,55,.08), transparent 72%)",
          filter: "blur(20px)",
          transform: "rotate(-16deg)",
        }}
      />
      {/* deep floor vignette */}
      <div
        className="absolute"
        style={{
          bottom: "-24%",
          left: "50%",
          width: "150%",
          height: "55%",
          transform: "translateX(-50%)",
          background: "radial-gradient(60% 100% at 50% 100%, rgba(1,4,9,.85), transparent 72%)",
        }}
      />
      {/* contribution-grid motif, faint along the bottom. Hidden below 980px:
          narrow layouts stack content much taller than one viewport, so this
          "floor" strip ends up floating behind mid-page content instead of
          only at the true bottom. */}
      <div
        className="absolute bottom-0 left-0 right-0 max-[980px]:hidden"
        style={{ height: "16%", opacity: 0.5, maskImage: "linear-gradient(to top, #000, transparent)", WebkitMaskImage: "linear-gradient(to top, #000, transparent)" }}
      >
        <ContribGrid />
      </div>
      <div className="absolute inset-0" style={{ opacity: 0.04, backgroundImage: NOISE, mixBlendMode: "overlay" }} />
    </div>
  );
}

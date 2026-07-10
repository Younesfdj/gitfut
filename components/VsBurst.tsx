import {
  PARTICLES,
  S_PATH,
  V_PATH,
  VS_H,
  VS_W,
  sliver,
  vsBurstBox,
} from "@/lib/vsBurst";

// Brand greens (globals.css): letters brand-mid, rim brand-hi, glow brand.
// Exported so the fixture poster paints its full-canvas strike and letters in
// exactly this kit.
export const VS_PALETTE = {
  fill: "#26a641",
  rim: "#56e06b",
  glow: "#39d353",
  core: "#eaffe8",
} as const;
const { fill: FILL, rim: RIM, glow: GLOW, core: CORE } = VS_PALETTE;

export default function VsBurst({ size = 10 }: { size: number }) {
  const { w, h } = vsBurstBox(size);
  return (
    <span
      style={{
        position: "relative",
        display: "flex",
        width: w,
        height: h,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${VS_W} ${VS_H}`}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        {/* lightning — glow halo, body, then the white-hot core; the letters
            paint after it, so the bolt passes BEHIND the VS like the art */}
        <polygon points={sliver(7)} fill={GLOW} opacity={0.16} />
        <polygon points={sliver(3.8)} fill={GLOW} opacity={0.38} />
        <polygon points={sliver(2.2)} fill={RIM} opacity={0.85} />
        <polygon points={sliver(0.9)} fill={CORE} opacity={0.95} />
        {PARTICLES.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={p.r}
            fill={p.bright ? CORE : GLOW}
            opacity={p.o}
          />
        ))}

        {/* letters over the bolt — the art's trick is a DARK halo around them
            (not a green glow): it swallows the bolt where it passes close, so
            the strike reads as behind the letter block */}
        <path
          d={V_PATH}
          fill="none"
          stroke="#02001e"
          strokeWidth={7}
          strokeLinejoin="round"
          opacity={0.85}
        />
        <path
          d={S_PATH}
          fill="none"
          stroke="#02001e"
          strokeWidth={7}
          strokeLinejoin="round"
          opacity={0.85}
        />
        <path
          d={V_PATH}
          fill={FILL}
          stroke={RIM}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <path
          d={S_PATH}
          fill={FILL}
          stroke={RIM}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

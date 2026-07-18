# GitFut UI Improvements — Changelog

All changes made on **2026-07-08**. 6 files modified across 7 areas.

---

## 1. globals.css

### What changed
Added new animation tokens, keyframes, and custom scrollbar styling.

### New animation tokens (added to `@theme`)
```diff
  --animate-pop: pop 0.16s cubic-bezier(0.16, 1, 0.3, 1) both;
  --animate-flag-raise: flag-raise 0.9s cubic-bezier(0.16, 1, 0.3, 1) both;
+ --animate-hero-shimmer: hero-shimmer 2.8s ease-in-out 0.6s both;
+ --animate-float-orb: float-orb 22s ease-in-out infinite;
+ --animate-halo-breathe: halo-breathe 3s ease-in-out infinite;
```

### New keyframes added (before the `prefers-reduced-motion` block)

| Keyframe | Purpose |
|---|---|
| `hero-shimmer` | One-shot green gradient sweep across the "GET SCOUTED." headline |
| `float-orb` | Slow 22s drift cycle for background floating particles |
| `halo-breathe` | Pulsing spotlight halo behind the loading screen mascot |
| `gradient-border` | Animated gradient sweep around the input border on focus |
| `tunnel-glow` | Stadium-tunnel style loading bar with glow |

### New scrollbar styling
```css
/* NEW — sleek brand-colored scrollbar */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(57, 211, 83, 0.2); border-radius: 999px; }
::-webkit-scrollbar-thumb:hover { background: rgba(57, 211, 83, 0.4); }
html { scrollbar-width: thin; scrollbar-color: rgba(57, 211, 83, 0.2) transparent; }
```

The existing `prefers-reduced-motion` block was preserved — it was just moved below the new keyframes.

---

## 2. Background.tsx

### What changed
Added 3 floating orb particles between the floor vignette and the contribution grid.

### Before
```tsx
{/* deep floor vignette */}
{/* ... vignette div ... */}

{/* contribution-grid motif, faint along the bottom */}
```

### After
```tsx
{/* deep floor vignette */}
{/* ... vignette div ... */}

{/* NEW — floating stadium-light orbs */}
<div className="animate-float-orb absolute"
  style={{ top: "12%", left: "18%", width: "clamp(120px,18vw,260px)", ... 
    background: "radial-gradient(closest-side, rgba(57,211,83,.18), transparent 70%)",
    filter: "blur(40px)" }} />

<div className="animate-float-orb absolute"
  style={{ top: "55%", right: "10%", ...
    background: "radial-gradient(closest-side, rgba(212,175,55,.12), transparent 70%)",
    filter: "blur(35px)", animationDelay: "-8s" }} />

<div className="animate-float-orb absolute"
  style={{ top: "30%", left: "60%", ...
    background: "radial-gradient(closest-side, rgba(86,224,107,.14), transparent 70%)",
    filter: "blur(30px)", animationDelay: "-15s" }} />

{/* contribution-grid motif, faint along the bottom */}
```

---

## 3. ScoutForm.tsx

### What changed
This was the biggest change — full rewrite with 5 new features.

### Before
- Static layout: all elements visible immediately
- Plain input with `border-line` + `focus:border-brand` + static box-shadow
- Faint `@` prefix (always same opacity)
- Scout count as bare text with pinging dot
- No entrance animation

### After

#### A. Stagger entrance component (NEW)
```tsx
// NEW — each child fades + lifts with a cascade delay
function Stagger({ step, children, className }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 80 + step * 120);
    return () => clearTimeout(t);
  }, [step]);
  // renders with opacity/transform transition
}
```
All 7 hero elements now wrapped in `<Stagger step={0..6}>`:
mascot, fixture tag, headline, description, form, examples, counter

#### B. Gradient text shimmer on headline
```diff
- <h1 className="font-display ...">
-   GET SCOUTED<span className="text-brand">.</span>
- </h1>

+ <h1 className="font-display ..."
+   style={{
+     backgroundImage: "linear-gradient(100deg, #e6edf3 0%, ... #39d353 48%, ...)",
+     backgroundSize: "220% 100%",
+     WebkitBackgroundClip: "text",
+     color: "transparent",
+     animation: "hero-shimmer 2.8s ease-in-out 0.9s both",
+   }}>
+   GET SCOUTED<span style={{ color: "#39d353" }}>.</span>
+ </h1>
```

#### C. Animated gradient border on input focus
```diff
- <div className="relative min-w-[200px] flex-1">
-   <input ... className="... border-line ... focus:border-brand focus:shadow-[...]" />
- </div>

+ <div className="relative min-w-[200px] flex-1">
+   {/* NEW — animated border glow behind input */}
+   <div className="... absolute -inset-[1.5px] rounded-[15px]"
+     style={{
+       opacity: focused ? 1 : 0,
+       background: "linear-gradient(135deg, #39d353, #26a641, #56e06b, ...)",
+       backgroundSize: "300% 300%",
+       animation: focused ? "gradient-border 4s ease infinite" : "none",
+     }} />
+   <div className="relative">
+     <span ... style={{ color: focused ? "#39d353" : "rgba(57,211,83,0.4)" }}>@</span>
+     <input ... className="... border-transparent bg-surface/90 ..." />
+   </div>
+ </div>
```

#### D. Typing-aware SCOUT button
```diff
- <button ... className="... shadow-[0_0_0_1px_...,0_10px_30px_...]">

+ <button ... className={`... ${
+   hasText && !loading
+     ? "shadow-[..._rgba(57,211,83,.45)] scale-[1.02]"  // scales up + glows
+     : ""
+ }`}>
```

#### E. Scout counter as scoreboard chip
```diff
- <span className="inline-flex items-baseline gap-[9px]">
-   {/* pinging dot + bare text */}
- </span>

+ <span className="inline-flex items-center gap-[9px] rounded-[10px]
+   border border-white/[0.08] bg-white/[0.02] px-[12px] py-[7px]
+   shadow-[inset_0_1px_3px_rgba(0,0,0,.4)]">
+   {/* pinging dot + text inside bordered LED-style chip */}
+ </span>
```

---

## 4. CardFan.tsx

### What changed
Added parallax depth + cascade entrance. (Holographic shimmer was added then removed due to visible rectangle artifact.)

### Before
```tsx
export default function CardFan({ cards, onPick }) {
  const [hover, setHover] = useState(null);
  const [open, setOpen] = useState(false);
  // static rendering, no mouse tracking, no entrance
  return (
    <div className="relative flex ...">
      {/* background "99" + circle */}
      <div onMouseLeave={...}>
        {cards.map((card, i) => (
          <div style={{ transform: `translateX(-50%) translate(...)` }}>
            <PlayerCard card={card} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### After
```tsx
export default function CardFan({ cards, onPick }) {
  const [hover, setHover] = useState(null);
  const [open, setOpen] = useState(false);

  // NEW — parallax refs
  const containerRef = useRef(null);
  const parallaxRef = useRef(null);

  // NEW — imperatively shift fan opposite to mouse
  const onMouseMove = useCallback((e) => {
    const px = ((e.clientX - r.left) / r.width - 0.5) * 2;
    const py = ((e.clientY - r.top) / r.height - 0.5) * 2;
    el.style.transform = `translate(${-px * 6}px, ${-py * 4}px)`;
  }, []);

  // NEW — cascade entrance
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    setTimeout(() => setEntered(true), 200);
  }, []);

  return (
    <div ref={containerRef} onMouseMove={onMouseMove} onMouseLeave={...}>
      {/* background "99" + circle — unchanged */}
      <div ref={parallaxRef} className="transition-transform duration-[600ms]">
        {cards.map((card, i) => (
          <div style={{
            // NEW — cards start 60px below + scaled down, then animate up
            transform: `... translate(..., ${entered ? ty : ty + 60}px) ...
              scale(${entered ? sc : 0.85})`,
            opacity: entered ? 1 : 0,
            transitionDelay: entered ? "0ms" : `${300 + i * 120}ms`,
          }}>
            <PlayerCard card={card} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 5. FooterCredit.tsx

### What changed
Added gradient divider line + hover glow on links.

```diff
- <div className="relative inline-flex max-w-full items-center justify-center">
-   <span className="... inset-y-[-6px] ..." />

+ <div className="relative inline-flex max-w-full flex-col items-center
+   justify-center gap-[10px]">
+   {/* NEW — gradient divider */}
+   <span className="h-px w-[clamp(120px,40vw,280px)]"
+     style={{ background: "linear-gradient(90deg, transparent,
+       rgba(57,211,83,.35), transparent)" }} />
+   <span className="... bottom-[-6px] top-[10px] ..." />
```

```diff
- const link = "... transition hover:text-ink hover:underline";
+ const link = "... transition-all duration-200 hover:text-ink hover:underline
+   hover:drop-shadow-[0_0_6px_rgba(57,211,83,.3)]";
```

---

## 6. LoadingScreen.tsx

### What changed
Added pulsing spotlight halo + upgraded progress bar.

### Before
```tsx
<Mascot size={220} kick ball />
{/* ... pun line ... */}
<div className="mt-7 h-[3px] w-[min(260px,70vw)] ...">
  <div className="h-full w-1/3 rounded-full
    bg-gradient-to-r from-transparent via-brand to-transparent"
    style={{ animation: "gf-load 1.3s ease-in-out infinite" }} />
</div>
<style>{`@keyframes gf-load{...}`}</style>
```

### After
```tsx
{/* NEW — breathing spotlight halo behind mascot */}
<div className="relative">
  <div className="animate-halo-breathe pointer-events-none absolute ..."
    style={{
      width: "320px", height: "320px", borderRadius: "50%",
      background: "radial-gradient(closest-side, rgba(57,211,83,.22), ...)",
      filter: "blur(20px)",
    }} />
  <Mascot size={220} kick ball />
</div>

{/* ... pun line ... */}

{/* NEW — wider stadium-tunnel progress bar with glow */}
<div className="mt-7 h-[5px] w-[min(280px,72vw)] ...
  shadow-[0_0_20px_rgba(57,211,83,.15)]">
  <div className="h-full w-1/3 rounded-full"
    style={{
      background: "linear-gradient(90deg, transparent,
        #39d353 40%, #56e06b 60%, transparent)",
      boxShadow: "0 0 12px rgba(57,211,83,.6),
        0 0 4px rgba(57,211,83,.8)",
      animation: "tunnel-glow 1.5s ease-in-out infinite",
    }} />
</div>
{/* inline <style> tag removed — keyframe now in globals.css */}
```

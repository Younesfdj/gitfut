// Card-image capture. The card's signature (gitfut.com + @handle) is hidden on
// the live card and only painted into exported images. To keep the watermark out
// of the on-screen card WITHOUT flashing it during the (slow, ~1s) html-to-image
// render, we never touch the live node: we render a clone tagged
// `.gitfut-capturing`, which reveals the signature.
//
// html-to-image only renders content the browser actually paints/decodes, so the
// clone CANNOT be parked off-screen (left:-99999px) or display:none'd — both
// yield a blank export. Instead we anchor the clone at the viewport origin so it
// paints (and its images decode), and wrap it in a 0×0 overflow-hidden holder so
// the user never sees it.

// Class added to the capture clone; `.gitfut-signature` reveals under it.
export const SIGNATURE_CLASS = "gitfut-capturing";

const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

export const isWebKit = (): boolean =>
  typeof navigator !== "undefined" &&
  navigator.vendor === "Apple Computer, Inc.";

function parseGradientStops(gradient: string): { color: string; at: number }[] {
  const start = gradient.indexOf("40%,");
  if (start < 0) return [];
  const inner = gradient.slice(start + 4, gradient.lastIndexOf(")"));
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of inner) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts
    .map((p, i) => {
      const m = p
        .trim()
        .match(/^(transparent|#[0-9a-f]+|rgba?\([^)]*\))(?:\s+([\d.]+)%)?$/i);
      if (!m) return null;
      const at =
        m[2] !== undefined
          ? Math.min(1, +m[2] / 100)
          : i === parts.length - 1
            ? 1
            : i / Math.max(1, parts.length - 1);
      return { color: m[1], at };
    })
    .filter((s): s is { color: string; at: number } => s !== null);
}

function bakeAvatar(
  src: HTMLImageElement,
  boxW: number,
  boxH: number,
  tint: string,
): string | null {
  const S = 3; // supersample so the baked feather edges stay crisp at export scale
  const w = Math.max(1, Math.round(boxW * S));
  const h = Math.max(1, Math.round(boxH * S));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx || !src.naturalWidth) return null;

  // photo — object-fit: cover, object-position: center 20%
  const cover = Math.max(w / src.naturalWidth, h / src.naturalHeight);
  const dw = src.naturalWidth * cover;
  const dh = src.naturalHeight * cover;
  ctx.drawImage(src, (w - dw) / 2, (h - dh) * 0.2, dw, dh);

  // edge tint over the photo (transparent core, tier colour toward the edges)
  const stops = parseGradientStops(tint);
  if (stops.length) {
    ctx.save();
    ctx.translate(0.52 * w, 0.4 * h);
    ctx.scale(0.72 * w, 0.76 * h); // ellipse 72% 76%
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    for (const s of stops) g.addColorStop(s.at, s.color);
    ctx.fillStyle = g;
    ctx.fillRect(-2, -2, 4, 4);
    ctx.restore();
  }

  // feather → alpha (destination-in keeps the photo only where the mask is opaque)
  // radial ellipse 66% 88% at 52% 40%: opaque core to 56%, gone by 80%
  ctx.save();
  ctx.globalCompositeOperation = "destination-in";
  ctx.translate(0.52 * w, 0.4 * h);
  ctx.scale(0.66 * w, 0.88 * h);
  const rf = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  rf.addColorStop(0, "#000");
  rf.addColorStop(0.56, "#000");
  rf.addColorStop(0.8, "rgba(0,0,0,0)");
  ctx.fillStyle = rf;
  ctx.fillRect(-2, -2, 4, 4);
  ctx.restore();

  // top fade (linear 180deg): transparent at the very top → opaque by 22%
  ctx.save();
  ctx.globalCompositeOperation = "destination-in";
  const tf = ctx.createLinearGradient(0, 0, 0, h);
  tf.addColorStop(0.01, "rgba(0,0,0,0)");
  tf.addColorStop(0.22, "#000");
  tf.addColorStop(1, "#000");
  ctx.fillStyle = tf;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // bottom-left fade (linear 220deg): opaque to 70% → transparent at the far corner
  ctx.save();
  ctx.globalCompositeOperation = "destination-in";
  const a = (220 * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
  const bf = ctx.createLinearGradient(
    w / 2 - half * dx,
    h / 2 - half * dy,
    w / 2 + half * dx,
    h / 2 + half * dy,
  );
  bf.addColorStop(0, "#000");
  bf.addColorStop(0.7, "#000");
  bf.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = bf;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  try {
    return canvas.toDataURL("image/png");
  } catch {
    return null; // cross-origin taint — caller keeps the masked avatar as-is
  }
}

export async function renderCardImage<T>(
  node: HTMLElement,
  capture: (target: HTMLElement) => Promise<T>,
  opts: { transparent?: boolean } = {},
): Promise<T> {
  const clone = node.cloneNode(true) as HTMLElement;
  clone.classList.add(SIGNATURE_CLASS);
  clone.style.width = `${node.offsetWidth}px`;
  clone.style.margin = "0";

  // Transparent cut-out: strip everything that paints OUTSIDE the card silhouette
  // — the tier glow halo and the card frame's own drop-shadow/glow filter — so the
  // copy is just the card on full transparency (the card art's corners are already
  // transparent). The signature stays.
  if (opts.transparent) {
    clone.querySelectorAll<HTMLElement>(".animate-glow").forEach((el) => {
      el.style.display = "none";
    });
    clone.querySelectorAll<HTMLElement>(".gitfut-card-frame").forEach((el) => {
      el.style.filter = "none";
    });
  }

  if (isWebKit()) {
    const avatar = clone.querySelector<HTMLElement>("[data-gitfut-avatar]");
    // Measure off the LIVE node (laid out), not the clone (not yet in the DOM).
    const srcBox = node.querySelector<HTMLElement>("[data-gitfut-avatar]");
    const src = srcBox?.querySelector<HTMLImageElement>("img") ?? null;
    const tintEl = srcBox?.querySelector<HTMLElement>("img + div") ?? null;
    const filter = src?.parentElement?.style.filter ?? "";
    if (src?.decode) await src.decode().catch(() => {});
    // Card width comes from the avatar box (inset:0 of the card) — NOT node,
    // which on the Story export is the 1080px frame, so the avatar was sized and
    // positioned against the wrong width (oversized / mispositioned). The box's
    // left/top/size are fractions of the card, so they scale with cardW.
    const cardW = srcBox?.offsetWidth ?? 0;
    if (avatar && src && cardW > 0 && src.naturalWidth > 0) {
      const boxW = cardW * 0.68;
      const boxH = cardW * 0.7;
      const baked = bakeAvatar(src, boxW, boxH, tintEl?.style.background ?? "");
      if (baked) {
        avatar.style.setProperty("-webkit-mask-image", "none");
        avatar.style.setProperty("mask-image", "none");
        const img = document.createElement("img");
        img.src = baked;
        img.alt = src.alt;
        img.style.cssText =
          `position:absolute;left:${cardW * 0.27}px;top:${cardW * 0.13}px;` +
          `width:${boxW}px;height:${boxH}px;object-fit:fill;filter:${filter};`;
        avatar.replaceChildren(img);
      }
    }
  }

  // 0×0 clip holder pinned at the viewport origin: the clone paints (so images
  // decode and html-to-image captures it) but is clipped out of view on screen.
  const holder = document.createElement("div");
  holder.style.cssText =
    "position:fixed;left:0;top:0;width:0;height:0;overflow:hidden;z-index:-1;pointer-events:none;";
  holder.appendChild(clone);
  document.body.appendChild(holder);

  try {
    await document.fonts.ready; // local FUT fonts must embed before capture
    // Wait for the clone's images to decode + let the browser paint, so the
    // export comes out fully rendered rather than blank.
    await Promise.all(
      Array.from(clone.querySelectorAll("img")).map((img) =>
        img.decode ? img.decode().catch(() => {}) : Promise.resolve(),
      ),
    );
    await nextFrame();
    await nextFrame();
    if (isWebKit() || opts.transparent) await capture(clone).catch(() => {});
    return await capture(clone);
  } finally {
    holder.remove();
  }
}

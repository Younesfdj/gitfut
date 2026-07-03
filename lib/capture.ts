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

export async function renderCardImage<T>(
  node: HTMLElement,
  capture: (target: HTMLElement) => Promise<T>,
  opts: { transparent?: boolean } = {},
): Promise<T> {
  const clone = node.cloneNode(true) as HTMLElement;
  clone.classList.add(SIGNATURE_CLASS);
  clone.style.width = `${node.offsetWidth}px`;
  clone.style.margin = "0";

  // Firefox workaround (Issue #7): explicit font-family to prevent html-to-image
  // from crashing in Firefox when getComputedStyle().fontFamily resolves undefined
  clone.style.fontFamily = node.style.fontFamily || window.getComputedStyle(node).fontFamily || "sans-serif";

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
    return await capture(clone);
  } finally {
    holder.remove();
  }
}

export type WhatsNewItem = {
  /** Unique, stable slug — forms the "already seen" key in sessionStorage. */
  id: string;
  /** Headline, rendered in the Bebas display face — write it in CAPS. */
  title: string;
  /** One–two sentences of plain info: what it does, where to find it. */
  body: string;
  /** Flip to false to retire the item without deleting it. */
  show: boolean;
};

// ── HOW TO ANNOUNCE SOMETHING NEW ────────────────────────────────────────
// 1. Add an object to the TOP of WHATS_NEW with a fresh, unique `id`.
// 2. Set `show: true`. Newest first — the modal renders them in array order.
// 3. Shipping a new id makes the bulletin reappear for everyone, even mid-
//    session (the id isn't in their "seen" set yet). Retire an item with
//    `show: false` — it won't retrigger. All items off → nothing renders.
// ─────────────────────────────────────────────────────────────────────────
export const WHATS_NEW: WhatsNewItem[] = [
  {
    id: "duels",
    title: "DUEL A RIVAL",
    body: "Take your card head-to-head against any dev. Six stats, one winner. The gold VS plate is on your card page.",
    show: true,
  },
];

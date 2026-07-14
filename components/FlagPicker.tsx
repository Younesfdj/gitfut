"use client";

import { Fragment, useCallback, useEffect, useId, useMemo, useReducer, useRef } from "react";
import { Pencil, Plus, Search, X } from "lucide-react";
import { flagPickerList } from "@/lib/wc26";
import { comboboxReducer, initialComboboxState } from "@/lib/comboboxNav";
import { useClickOutside } from "@/hooks/useClickOutside";

interface Props {
  /** Current flag (ISO 3166-1 alpha-2, lowercase) or "" / null for none. */
  value: string | null;
  onChange: (code: string) => void;
}

const FLAG = (code: string) => `/badges/flags/${code}.png`;

// The flag's slot on the 540×820 PlayerCard (kept in sync with PlayerCard.tsx).
// The trigger overlays exactly this region so "click the flag" feels native.
const SLOT = { left: "17.59%", top: "33.17%", width: "14.81%", height: "5.73%" } as const;

/**
 * Report-page flag editor. Renders a transparent hotspot exactly over the card's
 * flag slot — clicking it opens a searchable country popover. Designed to be a
 * SIBLING of the card-capture node (not a child), so it never serializes into
 * the downloaded PNG. When no flag is set yet it shows a subtle "add" affordance
 * so the slot is still discoverable.
 *
 * Accessibility: WAI-ARIA combobox — the hotspot is the button trigger
 * (aria-haspopup/expanded), the search input drives aria-activedescendant over a
 * listbox, full arrow/Home/End/Enter/Escape + click-outside to dismiss.
 */
export default function FlagPicker({ value, onChange }: Props) {
  const [state, dispatch] = useReducer(comboboxReducer, initialComboboxState);
  const { open, query, active } = state;

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const baseId = useId();
  const listId = `${baseId}-list`;
  const optionId = (i: number) => `${baseId}-opt-${i}`;

  // Browsing shows the 48 World-Cup teams first, so a national team isn't buried
  // 200 countries down; searching is left exactly as searchCountries ranked it
  // (see flagPickerList). The list stays FLAT either way — the combobox addresses
  // its options by index — so the group headers below are rendered as non-options.
  const { list: results, qualifiedCount } = useMemo(() => flagPickerList(query), [query]);

  const close = useCallback(() => dispatch({ type: "close" }), []);
  useClickOutside(rootRef, open, close);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (open && active >= 0) {
      listRef.current
        ?.querySelector(`#${CSS.escape(optionId(active))}`)
        ?.scrollIntoView({ block: "nearest" });
    }
    // optionId is stable (derived from useId()), so it's safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open]);

  const choose = (code: string) => {
    onChange(code);
    dispatch({ type: "close" });
    triggerRef.current?.focus();
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      dispatch({ type: open ? "move" : "open", delta: 1, count: results.length });
    }
  };

  const onSearchKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        dispatch({ type: "move", delta: 1, count: results.length });
        break;
      case "ArrowUp":
        e.preventDefault();
        dispatch({ type: "move", delta: -1, count: results.length });
        break;
      case "Home":
        e.preventDefault();
        dispatch({ type: "first", count: results.length });
        break;
      case "End":
        e.preventDefault();
        dispatch({ type: "last", count: results.length });
        break;
      case "Enter": {
        e.preventDefault();
        const pick = results[active] ?? (results.length === 1 ? results[0] : undefined);
        if (pick) choose(pick.code);
        break;
      }
      case "Escape":
        e.preventDefault();
        dispatch({ type: "close" });
        triggerRef.current?.focus();
        break;
    }
  };

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 z-20">
      {/* hotspot — overlays the flag slot; pointer-events re-enabled just here */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => dispatch({ type: "toggle" })}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={value ? "Change country flag" : "Add a country flag"}
        title={value ? "Change flag" : "Add flag"}
        style={SLOT}
        className="group pointer-events-auto absolute flex items-center justify-center outline-none ring-brand/0 transition focus-visible:ring-2 focus-visible:ring-brand/70"
      >
        {/* hover/focus scrim + edit glyph over the existing flag */}
        {value ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100 group-focus-visible:bg-black/45 group-focus-visible:opacity-100 group-aria-expanded:bg-black/45 group-aria-expanded:opacity-100">
            <Pencil className="h-[42%] w-[42%] text-white drop-shadow" />
          </span>
        ) : (
          // empty slot — a dashed, rectangular "add flag" affordance (shaped like
          // a flag, not rounded). A dark fill + dark dashed border keeps it clearly
          // visible on ANY tier (light gold/silver art as well as dark TOTY).
          <span className="absolute inset-0 flex items-center justify-center border-2 border-dashed border-white/80 bg-black/45 text-white transition group-hover:border-brand group-hover:bg-brand/30">
            <Plus className="h-[46%] w-[46%]" strokeWidth={2.5} />
          </span>
        )}
      </button>

      {open && (
        <div
          role="presentation"
          className="animate-pop pointer-events-auto absolute z-30 flex w-[280px] max-w-[80vw] flex-col overflow-hidden rounded-[14px] border border-line bg-panel/95 shadow-[0_18px_46px_-12px_rgba(0,0,0,.7)] backdrop-blur-[10px]"
          // Anchored below the flag slot and capped to the card's own height so
          // the list can't spill past the card onto the action buttons below it
          // (issue #35). % resolves against the card-sized root; list scrolls.
          style={{
            left: SLOT.left,
            top: `calc(${SLOT.top} + ${SLOT.height} + 2.5%)`,
            maxHeight: `calc(100% - ${SLOT.top} - ${SLOT.height} - 6%)`,
          }}
        >
          <div className="relative shrink-0 border-b border-line/70 p-[10px]">
            <Search
              size={15}
              className="pointer-events-none absolute left-[20px] top-1/2 -translate-y-1/2 text-ink-mute"
            />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => dispatch({ type: "setQuery", query: e.target.value })}
              onKeyDown={onSearchKeyDown}
              placeholder="Search country…"
              autoComplete="off"
              spellCheck={false}
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={active >= 0 ? optionId(active) : undefined}
              aria-label="Search country"
              className="h-10 w-full rounded-[9px] border border-line bg-bg/60 pl-[30px] pr-3 text-[14px] text-white outline-none transition focus:border-brand/70"
            />
          </div>

          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Countries"
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-[6px]"
          >
            {/* clear affordance — only when a flag is set and not mid-search, so
                the user can return the card to "no flag". */}
            {value && !query && (
              <li role="presentation" className="mb-[2px] border-b border-line/50 pb-[6px]">
                <button
                  type="button"
                  onClick={() => choose("")}
                  className="flex w-full items-center gap-[11px] rounded-[9px] px-[10px] py-[8px] text-[14px] text-ink-faint transition-colors hover:bg-white/[0.04] hover:text-ink-dim"
                >
                  <span className="flex h-[18px] w-[24px] flex-none items-center justify-center">
                    <X size={15} />
                  </span>
                  <span className="min-w-0 flex-1 text-left">Remove flag</span>
                </button>
              </li>
            )}
            {results.length === 0 && (
              <li role="presentation" className="px-3 py-6 text-center text-[13px] text-ink-mute">
                No country matches “{query}”.
              </li>
            )}
            {results.map((c, i) => {
              const selected = c.code === value;
              const highlighted = i === active;
              // Headers sit at the two group boundaries and are NOT options: they
              // carry role="presentation" so they stay out of the listbox's index
              // space, which is what arrow keys and aria-activedescendant address.
              const header =
                qualifiedCount === 0
                  ? null
                  : i === 0
                    ? "World Cup 26"
                    : i === qualifiedCount
                      ? "All countries"
                      : null;
              return (
                <Fragment key={c.code}>
                  {header && (
                    <li
                      role="presentation"
                      className="px-[10px] pb-[4px] pt-[10px] text-[10px] font-semibold uppercase tracking-[.12em] text-ink-mute"
                    >
                      {header}
                    </li>
                  )}
                <li
                  id={optionId(i)}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => dispatch({ type: "setActive", index: i })}
                  onClick={() => choose(c.code)}
                  className={`flex cursor-pointer items-center gap-[11px] rounded-[9px] px-[10px] py-[8px] text-[14px] transition-colors ${
                    highlighted ? "bg-brand/15 text-white" : "text-ink-dim"
                  }`}
                >
                  <img
                    src={FLAG(c.code)}
                    alt=""
                    width={24}
                    height={18}
                    loading="lazy"
                    className="h-[18px] w-[24px] flex-none rounded-[2px] object-cover shadow-[0_0_0_1px_rgba(255,255,255,.07)]"
                  />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className="font-mono text-[11px] uppercase tracking-[.08em] text-ink-mute">
                    {c.code}
                  </span>
                  {selected && <span className="h-[6px] w-[6px] flex-none rounded-full bg-brand" />}
                </li>
                </Fragment>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

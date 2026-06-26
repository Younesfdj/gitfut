// Pure keyboard/highlight logic for the country combobox, kept DOM-free so the
// navigation rules (wrap-around, clamping on filter, Enter/Escape semantics) are
// unit-testable without rendering. The component owns refs, focus and ARIA; this
// owns "given a key and the current state, what's the next state".

export interface ComboboxState {
  /** Whether the listbox popover is open. */
  open: boolean;
  /** Current search text. */
  query: string;
  /** Index of the highlighted option within the *filtered* list, or -1. */
  active: number;
}

export type ComboboxAction =
  | { type: "open" }
  | { type: "close" }
  | { type: "toggle" }
  | { type: "setQuery"; query: string }
  | { type: "move"; delta: number; count: number }
  | { type: "first"; count: number }
  | { type: "last"; count: number }
  | { type: "setActive"; index: number };

export const initialComboboxState: ComboboxState = { open: false, query: "", active: -1 };

// Wrap an index into [0, count). Empty list collapses to -1 (nothing active).
function wrap(index: number, count: number): number {
  if (count <= 0) return -1;
  return ((index % count) + count) % count;
}

export function comboboxReducer(state: ComboboxState, action: ComboboxAction): ComboboxState {
  switch (action.type) {
    case "open":
      return state.open ? state : { ...state, open: true };
    case "close":
      // Closing clears the highlight but keeps the query (re-open shows it).
      return { ...state, open: false, active: -1 };
    case "toggle":
      return state.open ? { ...state, open: false, active: -1 } : { ...state, open: true };
    case "setQuery":
      // A new query re-filters the list, so any highlight is stale — reset it
      // and ensure the popover is open to show results.
      return { ...state, query: action.query, open: true, active: -1 };
    case "move":
      if (!state.open) return { ...state, open: true, active: action.count > 0 ? 0 : -1 };
      return { ...state, active: wrap((state.active < 0 ? (action.delta > 0 ? -1 : 0) : state.active) + action.delta, action.count) };
    case "first":
      return { ...state, open: true, active: action.count > 0 ? 0 : -1 };
    case "last":
      return { ...state, open: true, active: action.count > 0 ? action.count - 1 : -1 };
    case "setActive":
      return { ...state, active: action.index };
    default:
      return state;
  }
}

import { describe, expect, it } from "vitest";
import { comboboxReducer, initialComboboxState, type ComboboxState } from "./comboboxNav";

const s = (over: Partial<ComboboxState> = {}): ComboboxState => ({ ...initialComboboxState, ...over });

describe("comboboxReducer", () => {
  it("opens, toggles, and closes (close clears highlight, keeps query)", () => {
    expect(comboboxReducer(s(), { type: "open" }).open).toBe(true);
    const open = comboboxReducer(s({ query: "ger", active: 2 }), { type: "open" });
    expect(comboboxReducer(open, { type: "toggle" }).open).toBe(false);
    const closed = comboboxReducer(s({ open: true, query: "ger", active: 2 }), { type: "close" });
    expect(closed).toEqual({ open: false, query: "ger", active: -1 });
  });

  it("a new query reopens and resets the (now stale) highlight", () => {
    const next = comboboxReducer(s({ open: false, active: 4 }), { type: "setQuery", query: "ja" });
    expect(next).toEqual({ open: true, query: "ja", active: -1 });
  });

  it("ArrowDown from nothing highlights the first option and opens if closed", () => {
    expect(comboboxReducer(s({ active: -1 }), { type: "move", delta: 1, count: 5 })).toMatchObject({
      open: true,
      active: 0,
    });
  });

  it("ArrowUp from nothing (active=-1) highlights the last option", () => {
    expect(comboboxReducer(s({ open: true, active: -1 }), { type: "move", delta: -1, count: 5 }).active).toBe(4);
  });

  it("wraps around both ends", () => {
    expect(comboboxReducer(s({ open: true, active: 4 }), { type: "move", delta: 1, count: 5 }).active).toBe(0);
    expect(comboboxReducer(s({ open: true, active: 0 }), { type: "move", delta: -1, count: 5 }).active).toBe(4);
  });

  it("Home/End jump to the bounds", () => {
    expect(comboboxReducer(s({ open: true, active: 3 }), { type: "first", count: 9 }).active).toBe(0);
    expect(comboboxReducer(s({ open: true, active: 3 }), { type: "last", count: 9 }).active).toBe(8);
  });

  it("collapses the highlight to -1 when the filtered list is empty", () => {
    expect(comboboxReducer(s({ open: true, active: 2 }), { type: "move", delta: 1, count: 0 }).active).toBe(-1);
    expect(comboboxReducer(s({ open: true }), { type: "first", count: 0 }).active).toBe(-1);
  });

  it("setActive records the hovered option without touching open/query", () => {
    const next = comboboxReducer(s({ open: true, query: "x" }), { type: "setActive", index: 7 });
    expect(next).toEqual({ open: true, query: "x", active: 7 });
  });
});

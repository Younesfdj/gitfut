"use client";

import { useEffect, useState } from "react";
import { askExampleChips } from "@/lib/scoutAsk/catalog";
import type { AskResult, HomeMode, TemplateVariable } from "@/lib/scoutAsk/types";
import { COUNTRIES } from "@/lib/countries";
import { ArrowRight } from "lucide-react";
import Mascot from "./Mascot";

interface Props {
  mode: HomeMode;
  onModeChange: (mode: HomeMode) => void;
  loading: boolean;
  error: string | null;
  scoutCount: number | null;
  onScout: (name: string) => void;
  onAsk: (query: string) => void;
  onOpenModal: () => void;
  askProgress: string | null;
  askResult: AskResult | null;
  onFillMissing: (name: string, value: string) => void;
}

const exampleClass =
  "cursor-pointer font-mono text-ink-soft underline decoration-brand/40 underline-offset-[3px] transition hover:text-brand";

function MissingVarPrompt({
  missing,
  onFill,
}: {
  missing: TemplateVariable[];
  onFill: (name: string, value: string) => void;
}) {
  const v = missing[0];
  if (!v) return null;

  if (v.kind === "country") {
    return (
      <label className="mt-3 flex max-w-[460px] flex-col gap-1.5 text-left text-[12.5px] text-ink-mute">
        Pick a country to finish the ask
        <select
          className="font-mono h-11 rounded-[12px] border-[1.5px] border-line bg-surface/70 px-3 text-[14px] text-white outline-none focus:border-brand"
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) onFill(v.name, e.target.value);
          }}
        >
          <option value="" disabled>
            country…
          </option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
    );
  }

  const options: string[] =
    v.kind === "position"
      ? ["ST", "RW", "CAM", "CM", "CDM", "CB"]
      : v.kind === "finish"
        ? ["bronze", "silver", "gold", "totw", "toty", "icon", "founder"]
        : v.kind === "stat"
          ? ["pac", "sho", "pas", "dri", "def", "phy"]
          : [];

  if (options.length === 0) {
    return (
      <p className="mt-3 max-w-[460px] text-[13px] text-ink-mute">
        Couldn’t detect <span className="text-ink-soft">{v.name}</span> in that question - try
        rephrasing.
      </p>
    );
  }

  return (
    <label className="mt-3 flex max-w-[460px] flex-col gap-1.5 text-left text-[12.5px] text-ink-mute">
      Choose {v.name}
      <select
        className="font-mono h-11 rounded-[12px] border-[1.5px] border-line bg-surface/70 px-3 text-[14px] text-white outline-none focus:border-brand"
        defaultValue=""
        onChange={(e) => {
          if (e.target.value) onFill(v.name, e.target.value);
        }}
      >
        <option value="" disabled>
          {v.name}…
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function ScoutForm({
  mode,
  onModeChange,
  loading,
  error,
  scoutCount,
  onScout,
  onAsk,
  onOpenModal,
  askProgress,
  askResult,
  onFillMissing,
}: Props) {
  const [name, setName] = useState("");
  const [askQuery, setAskQuery] = useState("");
  const [chips, setChips] = useState<string[]>([]);

  useEffect(() => {
    setChips(askExampleChips());
  }, []);

  const submitScout = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) onScout(name);
  };

  const submitAsk = (e: React.FormEvent) => {
    e.preventDefault();
    if (askQuery.trim()) onAsk(askQuery);
  };

  return (
    <div className="min-w-0 flex-1">
      {/* Stable hero chrome: reserved heights so Scout <-> Ask doesn't reflow the
          vertically-centered column (and jump the mascot). */}
      <div className="mb-1 -ml-2 max-[860px]:mx-auto max-[860px]:flex max-[860px]:justify-center">
        <Mascot size={150} />
      </div>

      <div className="mb-[18px] inline-flex items-center gap-[9px] rounded-[8px] border border-white/[0.08] bg-white/[0.025] px-[12px] py-[6px] max-[860px]:mx-auto">
        <span className="font-mono text-[10.5px] font-semibold tracking-[.18em] text-ink-soft">
          GITHUB
        </span>
        <span className="font-display text-[15px] mt-[1px] leading-none text-brand">×</span>
        <span className="font-display text-[15px] leading-none tracking-[.06em] text-ink">
          WORLD CUP <span className="text-gold-hi">26</span>
        </span>
      </div>

      {/* Scout | Ask - quiet text switch, not a card */}
      <div
        role="tablist"
        aria-label="Home mode"
        className="mb-4 flex h-[18px] items-center gap-3 max-[860px]:justify-center"
      >
        {(["scout", "ask"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => onModeChange(m)}
            className={
              mode === m
                ? "font-mono text-[11px] font-semibold tracking-[.16em] text-brand underline decoration-brand/50 underline-offset-[5px]"
                : "font-mono text-[11px] font-semibold tracking-[.16em] text-ink-mute transition hover:text-ink-soft"
            }
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Same visual weight as GET SCOUTED. - avoid wrap/reflow on mode switch */}
      <h1 className="font-display m-0 mb-3 min-h-[clamp(43px,5.75vw,85px)] whitespace-nowrap text-[clamp(52px,7vw,104px)] leading-[.82] tracking-[.005em]">
        {mode === "scout" ? (
          <>
            GET SCOUTED<span className="text-brand">.</span>
          </>
        ) : (
          <>
            ASK SCOUT<span className="text-brand">.</span>
          </>
        )}
      </h1>
      <p className="mb-[26px] min-h-[calc(1.5em*2)] max-w-[420px] text-[clamp(15px,1.7vw,18px)] font-medium leading-[1.5] text-ink-dim max-[860px]:mx-auto">
        {mode === "scout"
          ? "Your GitHub stats, turned into a World-Cup-style player card rated out of 99."
          : "Ask in plain language: top strikers from Botswana, Icon cards, highest pace."}
      </p>

      {mode === "scout" ? (
        <form
          onSubmit={submitScout}
          className="m-0 flex max-w-[460px] flex-wrap gap-[10px] max-[860px]:mx-auto"
        >
          <div className="relative min-w-[200px] flex-1">
            <span className="font-mono pointer-events-none absolute left-[18px] top-1/2 -translate-y-1/2 text-[17px] font-semibold text-brand/70" />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="github username"
              autoComplete="off"
              spellCheck={false}
              aria-label="GitHub username"
              className="font-mono h-14 w-full rounded-[14px] border-[1.5px] border-line bg-surface/70 pl-[34px] pr-5 text-[16px] font-medium text-white outline-none backdrop-blur-[4px] transition focus:border-brand focus:bg-surface focus:shadow-[0_0_0_4px_rgba(57,211,83,.16),0_0_42px_rgba(57,211,83,.24)]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="font-display group flex h-14 items-center gap-2 rounded-[14px] bg-gradient-to-b from-brand to-brand-mid px-7 text-[20px] tracking-[.06em] text-[#04130a] shadow-[0_0_0_1px_rgba(57,211,83,.4),0_10px_30px_rgba(57,211,83,.3)] transition hover:from-brand-hi hover:to-brand disabled:cursor-wait disabled:opacity-75"
          >
            {loading ? "SCOUTING…" : "SCOUT"}
            {!loading && (
              <ArrowRight
                size={19}
                strokeWidth={2.6}
                className="transition-transform group-hover:translate-x-0.5"
              />
            )}
          </button>
        </form>
      ) : (
        <form
          onSubmit={submitAsk}
          className="m-0 flex max-w-[460px] flex-wrap gap-[10px] max-[860px]:mx-auto"
        >
          <div className="relative min-w-[200px] flex-1">
            <input
              value={askQuery}
              onChange={(e) => setAskQuery(e.target.value)}
              placeholder="Who are the top strikers from Botswana?"
              autoComplete="off"
              spellCheck={false}
              aria-label="Ask the scout"
              className="font-mono h-14 w-full rounded-[14px] border-[1.5px] border-line bg-surface/70 px-5 text-[15px] font-medium text-white outline-none backdrop-blur-[4px] transition focus:border-brand focus:bg-surface focus:shadow-[0_0_0_4px_rgba(57,211,83,.16),0_0_42px_rgba(57,211,83,.24)]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="font-display group flex h-14 items-center gap-2 rounded-[14px] bg-gradient-to-b from-brand to-brand-mid px-7 text-[20px] tracking-[.06em] text-[#04130a] shadow-[0_0_0_1px_rgba(57,211,83,.4),0_10px_30px_rgba(57,211,83,.3)] transition hover:from-brand-hi hover:to-brand disabled:cursor-wait disabled:opacity-75"
          >
            {loading ? "ASKING…" : "ASK"}
            {!loading && (
              <ArrowRight
                size={19}
                strokeWidth={2.6}
                className="transition-transform group-hover:translate-x-0.5"
              />
            )}
          </button>
        </form>
      )}

      {/* Fixed slot below the form so status/errors don't shove the hero when they appear */}
      <div className="mt-[13px] min-h-[44px] max-w-[460px] max-[860px]:mx-auto">
        {error ? (
          <div
            role="alert"
            className="rounded-[10px] border border-[#f85149]/30 bg-[#f85149]/10 px-[13px] py-[10px] text-[13.5px] font-medium text-[#ff9d96]"
          >
            {error}
          </div>
        ) : mode === "ask" && askProgress ? (
          <p className="font-mono text-[12px] text-ink-mute">{askProgress}</p>
        ) : mode === "ask" && askResult?.missing.length ? (
          <MissingVarPrompt missing={askResult.missing} onFill={onFillMissing} />
        ) : mode === "ask" && askResult && !askResult.missing.length ? (
          <p className="text-[13px] leading-[1.35] text-ink-mute">
            matched{" "}
            <span className="text-ink-soft">{askResult.renderedQuery}</span>
            {askResult.liveSource ? (
              <>
                {" "}
                · via{" "}
                <span className="text-ink-soft">
                  {askResult.liveSource === "search" ? "GitHub search" : "no profiles"}
                </span>
              </>
            ) : null}
            {askResult.cards.length === 0
              ? ` - ${askResult.liveMessage ?? "no matching cards yet"}`
              : ` - ${askResult.cards.length} found`}
          </p>
        ) : null}
      </div>

      <div className="mt-[14px] flex h-[20px] max-w-[460px] items-center overflow-hidden text-[13px] text-ink-mute max-[860px]:mx-auto">
        {mode === "scout" ? (
          <span className="truncate">
            try{" "}
            <button type="button" onClick={() => onScout("torvalds")} className={exampleClass}>
              torvalds
            </button>{" "}
            ·{" "}
            <button
              type="button"
              onClick={() => onScout("sindresorhus")}
              className={exampleClass}
            >
              sindresorhus
            </button>{" "}
            · or your own
          </span>
        ) : (
          <span className="truncate">
            try{" "}
            {chips.slice(0, 2).map((chip, i) => (
              <span key={chip}>
                {i > 0 ? " · " : null}
                <button
                  type="button"
                  onClick={() => {
                    setAskQuery(chip);
                    onAsk(chip);
                  }}
                  className={exampleClass}
                >
                  {chip.length > 28 ? `${chip.slice(0, 26)}…` : chip}
                </button>
              </span>
            ))}
          </span>
        )}
      </div>

      <div className="mt-[20px] flex flex-wrap items-center gap-x-[14px] gap-y-[10px] max-[860px]:justify-center">
        {scoutCount != null && (
          <>
            <span className="inline-flex items-baseline gap-[9px]">
              <span
                className="relative flex h-[7px] w-[7px] translate-y-[-1px] self-center"
                aria-hidden
              >
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
                <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-brand" />
              </span>
              <span className="font-display text-[20px] leading-none tabular-nums text-ink">
                {scoutCount.toLocaleString("en-US")}
              </span>
              <span className="text-[12px] text-ink-mute">cards rated</span>
            </span>
            <span aria-hidden className="h-[12px] w-px bg-white/[0.12] max-[860px]:hidden" />
          </>
        )}
        <button
          type="button"
          onClick={onOpenModal}
          className="cursor-pointer text-[12.5px] font-semibold text-ink-soft underline-offset-2 transition hover:text-brand hover:underline"
        >
          how it works ↗
        </button>
      </div>
    </div>
  );
}

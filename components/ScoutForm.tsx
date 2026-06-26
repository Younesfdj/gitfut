"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import Mascot from "./Mascot";

interface Props {
  loading: boolean;
  error: string | null;
  onScout: (name: string) => void;
  onOpenModal: () => void;
}

const exampleClass =
  "cursor-pointer font-mono text-ink-soft underline decoration-brand/40 underline-offset-[3px] transition hover:text-brand";

export default function ScoutForm({
  loading,
  error,
  onScout,
  onOpenModal,
}: Props) {
  const [name, setName] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) onScout(name);
  };

  return (
    <div className="min-w-0 flex-1">
      {/* mascot — the brand face on the hero */}
      <div className="mb-1 -ml-2 max-[860px]:mx-auto max-[860px]:flex max-[860px]:justify-center">
        <Mascot size={150} />
      </div>

      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-3 py-1 text-[11.5px] font-semibold tracking-wide text-brand max-[860px]:mx-auto">
        <span className="h-[6px] w-[6px] animate-pulse rounded-full bg-brand shadow-[0_0_8px_var(--color-brand)]" />
        GITHUB × WORLD CUP 26
      </div>

      <h1 className="font-display m-0 mb-3 text-[clamp(52px,7vw,104px)] leading-[.82] tracking-[.005em]">
        GET SCOUTED<span className="text-brand">.</span>
      </h1>
      <p className="mb-[26px] max-w-[420px] text-[clamp(15px,1.7vw,18px)] font-medium leading-[1.5] text-ink-dim max-[860px]:mx-auto">
        Your GitHub stats, turned into a World-Cup-style player card rated out
        of 99.
      </p>

      <form
        onSubmit={submit}
        className="m-0 flex max-w-[460px] flex-wrap gap-[10px] max-[860px]:mx-auto"
      >
        <div className="relative min-w-[200px] flex-1">
          <span className="font-mono pointer-events-none absolute left-[18px] top-1/2 -translate-y-1/2 text-[17px] font-semibold text-brand/70"></span>
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

      {error && (
        <div
          role="alert"
          className="mt-[13px] max-w-[460px] rounded-[10px] border border-[#f85149]/30 bg-[#f85149]/10 px-[13px] py-[10px] text-[13.5px] font-medium text-[#ff9d96]"
        >
          {error}
        </div>
      )}

      <div className="mt-[14px] text-[13px] text-ink-mute">
        try{" "}
        <button
          type="button"
          onClick={() => onScout("torvalds")}
          className={exampleClass}
        >
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
      </div>

      <div className="mt-[22px] flex flex-wrap items-center gap-x-[18px] gap-y-2 text-[12.5px] font-medium text-ink-mute max-[860px]:justify-center">
        <span className="inline-flex items-center gap-2">
          <span className="h-[7px] w-[7px] rounded-full bg-brand shadow-[0_0_8px_var(--color-brand)]" />
          <strong className="font-bold text-ink-dim">12,480</strong> cards rated
          this window
        </span>
        <button
          type="button"
          onClick={onOpenModal}
          className="cursor-pointer font-semibold text-ink-soft transition hover:text-brand"
        >
          how it works ↗
        </button>
      </div>
    </div>
  );
}

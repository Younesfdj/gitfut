"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// Navigates to /leaderboard?focus=<login>. The server then scouts the login (so
// a never-seen user is added to the board) and renders their rank + neighbours.
export default function LeaderboardSearch({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [isPending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const login = value.trim().replace(/^@/, "");
    if (!login) return;
    startTransition(() => router.push(`/leaderboard?focus=${encodeURIComponent(login)}`));
  };

  return (
    <form onSubmit={submit} className="mt-5 flex gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="find your rank — github username"
        aria-label="GitHub username"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="h-11 flex-1 rounded-xl border border-white/12 bg-white/[.04] px-4 text-[15px] text-ink outline-none transition focus:border-brand/60"
      />
      <button
        type="submit"
        disabled={isPending}
        className="font-display h-11 rounded-xl bg-brand px-5 text-[15px] tracking-[.06em] text-[#04130a] transition hover:bg-brand-hi disabled:opacity-60"
      >
        {isPending ? "…" : "FIND"}
      </button>
    </form>
  );
}

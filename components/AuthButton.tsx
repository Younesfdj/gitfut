"use client";

import { useAuth, signInHref, signOut } from "@/hooks/useAuth";

/** Compact GitHub sign-in / signed-in chip for the result top bar and home. */
export default function AuthButton({ returnTo }: { returnTo: string }) {
  const { configured, login, avatarUrl, loading } = useAuth();

  if (!configured || loading) return null;

  if (login) {
    return (
      <div className="flex items-center gap-2">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            width={22}
            height={22}
            className="rounded-full border border-white/15"
          />
        ) : null}
        <span className="font-mono hidden text-[12px] text-ink-soft sm:inline">@{login}</span>
        <button
          type="button"
          onClick={() => signOut(returnTo)}
          className="font-mono cursor-pointer rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-semibold tracking-wide text-ink-soft transition hover:border-white/20 hover:text-ink"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <a
      href={signInHref(returnTo)}
      className="font-mono inline-flex items-center gap-1.5 rounded-lg border border-brand/35 bg-brand/10 px-2.5 py-1.5 text-[11px] font-semibold tracking-wide text-brand transition hover:border-brand/60 hover:bg-brand/15"
    >
      Sign in with GitHub
    </a>
  );
}

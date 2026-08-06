"use client";

import Link from "next/link";
import { useAuth, signInHref, signOut } from "@/hooks/useAuth";

/** Compact GitHub sign-in / signed-in chip for the result top bar and home. */
export default function AuthButton({ returnTo }: { returnTo: string }) {
  const { configured, login, avatarUrl, loading } = useAuth();

  if (!configured || loading) return null;

  if (login) {
    const profileHref = `/${encodeURIComponent(login)}`;
    return (
      <div className="flex items-center gap-2">
        <Link
          href={profileHref}
          className="group flex items-center gap-2 rounded-lg outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand/50"
          title={`Open your GitFut card (@${login})`}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              width={22}
              height={22}
              className="rounded-full border border-white/15 transition group-hover:border-brand/40"
            />
          ) : null}
          <span className="font-mono hidden text-[12px] text-ink-soft transition group-hover:text-brand sm:inline">
            @{login}
          </span>
        </Link>
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

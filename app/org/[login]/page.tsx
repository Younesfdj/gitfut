import type { Metadata } from "next";
import Link from "next/link";
import Background from "@/components/Background";
import { fetchOrganization, fetchOrganizationMembers } from "@/lib/github/client";
import { getRepoStars } from "@/lib/github/stars";
import SquadView from "@/components/SquadView";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ login: string }> }): Promise<Metadata> {
  const { login } = await params;
  try {
    const org = await fetchOrganization(login);
    const clubName = org.name || org.login;
    return {
      title: `${clubName} FC · GitFut`,
      description: `${clubName} scouted on GitFut: build the best XI from GitHub organization members.`,
      alternates: { canonical: `/org/${org.login}` },
      twitter: { card: "summary_large_image" },
    };
  } catch {
    return { title: `${login} FC · GitFut`, robots: { index: false } };
  }
}

function OrgError({ login, message }: { login: string; message: string }) {
  return (
    <main className="relative z-[2] mx-auto flex min-h-screen max-w-[560px] flex-col items-center justify-center px-6 text-center">
      <div className="font-display text-[12px] font-bold tracking-[.3em] text-brand">CLUB SCOUT</div>
      <h1 className="font-display mt-3 text-[clamp(30px,6vw,48px)] font-black leading-[.95]">
        Club not found
      </h1>
      <p className="mt-3 text-[15.5px] leading-[1.5] text-ink-soft">{message}</p>
      <Link
        href="/"
        className="font-display mt-7 inline-flex h-[46px] items-center rounded-xl bg-brand px-6 text-[16px] tracking-[.06em] text-[#04130a] transition hover:bg-brand-hi"
      >
        BACK TO THE BENCH
      </Link>
    </main>
  );
}

export default async function OrgPage({
  params,
}: {
  params: Promise<{ login: string }>;
}) {
  const { login } = await params;
  const stars = await getRepoStars();

  let orgInfo;
  let members;
  try {
    [orgInfo, members] = await Promise.all([
      fetchOrganization(login),
      fetchOrganizationMembers(login),
    ]);
  } catch (e) {
    const msg = (e as { message?: string }).message ?? "Something went wrong.";
    return (
      <div className="relative min-h-screen overflow-x-hidden text-ink">
        <Background />
        <OrgError login={login} message={msg} />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden text-ink">
      <Background />
      <SquadView orgInfo={orgInfo} members={members} stars={stars} />
    </div>
  );
}

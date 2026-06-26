"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ResultView from "@/components/ResultView";
import { writeCardCache } from "@/hooks/useScout";
import type { Card } from "@/lib/scoring/types";

// Client wrapper: a server component can't pass callbacks across the boundary,
// so navigation and the report-page flag edit are wired here. Editing the flag
// updates the card in view, reflects the choice in the URL (?country=, removed
// when cleared) so a re-share / reload keeps it, and writes the localStorage
// cache so the home flow sees the same choice within the TTL.
export default function ScoutRoute({ card: initial }: { card: Card }) {
  const router = useRouter();
  const [card, setCard] = useState(initial);

  const onCountryChange = (code: string) => {
    const next = { ...card, country: code };
    setCard(next);
    writeCardCache(next);
    const url = new URL(window.location.href);
    if (code) url.searchParams.set("country", code);
    else url.searchParams.delete("country");
    router.replace(url.pathname + url.search, { scroll: false });
  };

  return (
    <ResultView
      key={card.login}
      card={card}
      onBack={() => router.push("/")}
      onCountryChange={onCountryChange}
    />
  );
}

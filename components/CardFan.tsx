"use client";

import { useEffect, useRef, useState } from "react";
import type { Card } from "@/lib/scoring/types";
import PlayerCard from "./PlayerCard";

const ANGLE = 7;
const SPREAD_CLOSED = 88;
const SPREAD_OPEN = 124;
/** Cards visible per page in the fan (swipe for more). */
export const FAN_PAGE_SIZE = 4;
const SWIPE_THRESHOLD = 56;

interface Props {
  cards: Card[];
  onPick: (login: string) => void;
  /** Enable drag/swipe pagination when there are more than FAN_PAGE_SIZE cards. */
  paginate?: boolean;
}

export default function CardFan({ cards, onPick, paginate = true }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const startX = useRef(0);
  const startY = useRef(0);
  const axis = useRef<"none" | "x" | "y">("none");
  const didSwipe = useRef(false);
  const pageRef = useRef(0);
  const dragXRef = useRef(0);

  const pageCount = paginate ? Math.max(1, Math.ceil(cards.length / FAN_PAGE_SIZE)) : 1;
  const safePage = Math.min(page, pageCount - 1);
  const pageCards = paginate
    ? cards.slice(safePage * FAN_PAGE_SIZE, safePage * FAN_PAGE_SIZE + FAN_PAGE_SIZE)
    : cards.slice(0, FAN_PAGE_SIZE);
  const center = (pageCards.length - 1) / 2;
  const canPage = paginate && pageCount > 1;

  useEffect(() => {
    setPage(0);
    pageRef.current = 0;
    setDragX(0);
  }, [cards]);

  useEffect(() => {
    pageRef.current = safePage;
  }, [safePage]);

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(pageCount - 1, next));
    setPage(clamped);
    pageRef.current = clamped;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!canPage) return;
    // Ignore secondary buttons; allow touch + primary mouse.
    if (e.pointerType === "mouse" && e.button !== 0) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    axis.current = "none";
    didSwipe.current = false;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !canPage) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (axis.current === "none") {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      axis.current = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
    }
    if (axis.current !== "x") return;
    e.preventDefault();
    // Rubber-band at edges.
    const atStart = pageRef.current === 0 && dx > 0;
    const atEnd = pageRef.current === pageCount - 1 && dx < 0;
    const next = atStart || atEnd ? dx * 0.35 : dx;
    dragXRef.current = next;
    setDragX(next);
  };

  const endDrag = () => {
    if (!dragging) return;
    setDragging(false);
    const dx = dragXRef.current;
    if (axis.current === "x" && Math.abs(dx) >= SWIPE_THRESHOLD) {
      didSwipe.current = true;
      // Drag left (negative) -> next page; drag right -> previous.
      goTo(pageRef.current + (dx < 0 ? 1 : -1));
    }
    dragXRef.current = 0;
    setDragX(0);
    axis.current = "none";
  };

  const onPickCard = (login: string) => {
    if (didSwipe.current) {
      didSwipe.current = false;
      return;
    }
    onPick(login);
  };

  return (
    <div className="relative flex min-w-0 flex-[1.12] flex-col items-center justify-center gap-3">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center max-[860px]:hidden"
      >
        <div className="absolute aspect-square w-[min(330px,76%)] rounded-full border border-white/[0.06]" />
        <div
          className="font-display font-black leading-[.8] text-transparent"
          style={{ fontSize: "clamp(170px,22vw,300px)", WebkitTextStroke: "1.4px rgba(255,255,255,.045)" }}
        >
          99
        </div>
      </div>

      <div
        role={canPage ? "region" : undefined}
        aria-roledescription={canPage ? "carousel" : undefined}
        aria-label={canPage ? `Card results, page ${safePage + 1} of ${pageCount}` : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onMouseLeave={() => {
          setOpen(false);
          setHover(null);
        }}
        className={`relative h-[360px] w-[min(600px,98%)] touch-pan-y max-[860px]:flex max-[860px]:h-auto max-[860px]:w-full max-[860px]:flex-col max-[860px]:items-center max-[860px]:gap-[18px] ${
          canPage ? "cursor-grab active:cursor-grabbing" : ""
        }`}
        style={{
          transform: dragX ? `translateX(${dragX}px)` : undefined,
          transition: dragging ? "none" : "transform 280ms cubic-bezier(.2,.8,.2,1)",
        }}
      >
        {pageCards.map((card, i) => {
          const off = i - center;
          const hovered = hover === i;
          const rot = open ? 0 : off * ANGLE;
          const tx = (open ? SPREAD_OPEN : SPREAD_CLOSED) * off;
          const ty = hovered ? -36 : open ? -4 : Math.abs(off) * 14;
          const sc = hovered ? 1.05 : 1;
          return (
            <div
              key={`${card.login}-${safePage}`}
              onClick={() => onPickCard(card.login)}
              onMouseEnter={() => {
                setHover(i);
                setOpen(true);
              }}
              onMouseLeave={() => setHover(null)}
              className="absolute left-1/2 top-[18px] w-[184px] origin-bottom cursor-pointer transition-transform duration-[450ms] ease-[cubic-bezier(.2,.8,.2,1)] max-[860px]:static max-[860px]:w-[min(230px,66vw)] max-[860px]:!transform-none max-[860px]:!z-auto"
              style={{
                transform: `translateX(-50%) translate(${tx}px, ${ty}px) rotate(${rot}deg) scale(${sc})`,
                zIndex: hovered ? 60 : 40 - i * 5,
              }}
            >
              <PlayerCard card={card} />
            </div>
          );
        })}
      </div>

      {canPage ? (
        <div className="relative z-[2] flex h-7 items-center gap-3">
          <button
            type="button"
            aria-label="Previous cards"
            disabled={safePage === 0}
            onClick={() => goTo(safePage - 1)}
            className="font-mono text-[11px] tracking-[.12em] text-ink-mute transition enabled:hover:text-brand disabled:opacity-30"
          >
            PREV
          </button>
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Card pages">
            {Array.from({ length: pageCount }, (_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === safePage}
                aria-label={`Page ${i + 1}`}
                onClick={() => goTo(i)}
                className={
                  i === safePage
                    ? "h-1.5 w-4 rounded-full bg-brand"
                    : "h-1.5 w-1.5 rounded-full bg-white/25 transition hover:bg-white/45"
                }
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="Next cards"
            disabled={safePage >= pageCount - 1}
            onClick={() => goTo(safePage + 1)}
            className="font-mono text-[11px] tracking-[.12em] text-ink-mute transition enabled:hover:text-brand disabled:opacity-30"
          >
            NEXT
          </button>
          <span className="font-mono text-[10px] tabular-nums text-ink-mute">
            {safePage + 1}/{pageCount}
          </span>
        </div>
      ) : (
        <div className="h-7" aria-hidden />
      )}
    </div>
  );
}

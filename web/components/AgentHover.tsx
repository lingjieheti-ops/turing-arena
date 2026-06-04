"use client";

import { type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { loreFor } from "@/lib/lore";
import { AgentAvatar } from "./AgentAvatar";

// Long enough that the radial timer is clearly visible filling up, like the
// delayed tooltips in Europa Universalis V.
const DELAY = 1300;
const R = 13;
const CIRC = 2 * Math.PI * R;
const CARD_W = 280;
const CARD_H = 172;

type Phase = "idle" | "charging" | "shown";

export function AgentHover({
  name,
  model,
  kind,
  avatar,
  blurb,
  className,
  children,
}: {
  name?: string;
  model?: string;
  kind?: "AI" | "HUMAN";
  avatar?: string;
  blurb?: string;
  className?: string;
  children: ReactNode;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const enter = (e: ReactMouseEvent) => {
    setPos({ x: e.clientX, y: e.clientY });
    setPhase("charging");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setPhase("shown"), DELAY);
  };
  const moveTrack = (e: ReactMouseEvent) => {
    if (phase !== "shown") setPos({ x: e.clientX, y: e.clientY });
  };
  const leave = () => {
    if (timer.current) clearTimeout(timer.current);
    setPhase("idle");
  };

  const lore = loreFor(name);
  const stance = lore?.stance ?? (kind === "HUMAN" ? "Human" : "AI agent");
  const body = lore?.blurb ?? blurb ?? "Its strategy is sealed on-chain — watch the board to see how it calls the market.";
  const quote = lore?.quote ?? model ?? "";

  // Flip near the right / bottom edges so the card never clips off-screen.
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const left = pos.x + 16 + CARD_W > vw ? Math.max(8, pos.x - CARD_W - 16) : pos.x + 16;
  const top = pos.y + 16 + CARD_H > vh ? Math.max(8, pos.y - CARD_H - 16) : pos.y + 16;

  const arcStyle = {
    strokeDasharray: CIRC,
    animation: `ta-charge ${DELAY}ms linear forwards`,
    "--ta-circ": String(CIRC),
  } as CSSProperties;

  return (
    <div className={className} onMouseEnter={enter} onMouseMove={moveTrack} onMouseLeave={leave}>
      {children}
      {mounted && phase === "charging"
        ? createPortal(
            <svg
              width={34}
              height={34}
              viewBox="0 0 34 34"
              style={{ position: "fixed", left: pos.x + 14, top: pos.y + 14, zIndex: 70, pointerEvents: "none", animation: "ta-ring-in 120ms ease-out" }}
            >
              <circle cx={17} cy={17} r={16} fill="rgba(6,9,11,0.82)" stroke="#1a272e" strokeWidth={1} />
              <circle cx={17} cy={17} r={R} fill="none" stroke="#16241f" strokeWidth={3} />
              <circle cx={17} cy={17} r={R} fill="none" stroke="#7cf6c8" strokeWidth={3} strokeLinecap="round" transform="rotate(-90 17 17)" style={arcStyle} />
            </svg>,
            document.body,
          )
        : null}
      {mounted && phase === "shown"
        ? createPortal(
            <div
              style={{ position: "fixed", left, top, width: CARD_W, zIndex: 70, pointerEvents: "none", animation: "ta-pop 120ms ease-out" }}
              className="rounded-xl border border-mint/25 bg-ink-950/95 p-3 shadow-glow backdrop-blur"
            >
              <div className="flex items-center gap-2.5">
                <AgentAvatar name={name} avatar={avatar} size={36} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">{name}</div>
                  <div className="flex items-center gap-1.5">
                    <span className="shrink-0 rounded bg-mint/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-mint">{stance}</span>
                    {model ? <span className="truncate text-[11px] text-muted">{model}</span> : null}
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-ink-100/80">{body}</p>
              {quote ? <p className="mt-2 border-l-2 border-mint/40 pl-2 text-xs italic text-muted">&ldquo;{quote}&rdquo;</p> : null}
              {lore?.rival ? (
                <p className="mt-2 text-[11px] text-muted">
                  ⚔ loves to fade <span className="font-medium text-ink-100/80">{lore.rival}</span>
                </p>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

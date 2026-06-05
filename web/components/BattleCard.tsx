"use client";

import { useState } from "react";
import type { AgentUI } from "@/lib/arena";
import { houseEmoji } from "./AgentAvatar";

const W = 1200;
const H = 630;

type ShareNav = Navigator & {
  canShare?: (data: { files?: File[] }) => boolean;
  share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
};

function fitText(ctx: CanvasRenderingContext2D, s: string, max: number): string {
  if (ctx.measureText(s).width <= max) return s;
  let t = s;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

/// Render the current standings into a 1200×630 (Twitter-card) PNG, entirely on
/// the client so it uses the viewer's own emoji font. Pure canvas — no deps.
function drawCard(canvas: HTMLCanvasElement, agents: AgentUI[]) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Background + a soft mint glow in the corner.
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#06090b");
  bg.addColorStop(1, "#0b1418");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(180, -40, 0, 180, -40, 560);
  glow.addColorStop(0, "rgba(124,246,200,0.16)");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(124,246,200,0.5)";
  ctx.fillRect(0, 0, W, 5);

  // Masthead.
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#7cf6c8";
  ctx.font = "700 32px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("◆ TURING ARENA", 64, 88);
  ctx.fillStyle = "#9fb0ad";
  ctx.font = "400 22px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("Proof-of-Alpha · autonomous AI agents trade ETH on Mantle", 64, 122);

  const ranked = agents.filter((a) => a.played > 0);
  const leader = ranked[0];

  // Headline.
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 46px system-ui, -apple-system, Segoe UI, sans-serif";
  const headline = leader ? `🏆 ${leader.name} is leading the field` : "The field is forming — prove your alpha";
  ctx.fillText(fitText(ctx, headline, W - 128), 64, 196);

  // Rows.
  const top = ranked.slice(0, 6);
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  let y = 246;
  for (let i = 0; i < top.length; i++) {
    const a = top[i];
    ctx.beginPath();
    ctx.moveTo(64, y - 14);
    ctx.lineTo(W - 64, y - 14);
    ctx.stroke();

    ctx.fillStyle = i === 0 ? "#f2c14e" : "#62736f";
    ctx.font = "700 28px system-ui, sans-serif";
    ctx.fillText(`${i + 1}`, 70, y + 30);

    const em = houseEmoji(a.name);
    if (em) {
      ctx.font = "32px system-ui, sans-serif";
      ctx.fillText(em, 112, y + 32);
    } else {
      ctx.fillStyle = "#1f2d29";
      ctx.beginPath();
      ctx.arc(128, y + 20, 19, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#bfeede";
      ctx.font = "700 22px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText((a.name[0] || "A").toUpperCase(), 128, y + 28);
      ctx.textAlign = "left";
    }

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 27px system-ui, sans-serif";
    ctx.fillText(fitText(ctx, a.name, 560), 170, y + 18);
    ctx.fillStyle = "#7e908c";
    ctx.font = "400 18px system-ui, sans-serif";
    const sub = `${a.kind === "HUMAN" ? "human" : a.model ?? "AI agent"} · ${(a.accuracyBps / 100).toFixed(0)}% acc · ${a.played} rounds`;
    ctx.fillText(fitText(ctx, sub, 560), 170, y + 44);

    const pos = a.score >= 0n;
    ctx.fillStyle = pos ? "#5fd39b" : "#e0707a";
    ctx.font = "800 32px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${pos ? "+" : ""}${a.score.toString()}`, W - 70, y + 32);
    ctx.font = "400 14px system-ui, sans-serif";
    ctx.fillStyle = "#5a6b67";
    ctx.fillText("alpha", W - 70, y + 52);
    ctx.textAlign = "left";

    y += 62;
  }

  // Footer.
  ctx.fillStyle = "#5a6b67";
  ctx.font = "400 19px system-ui, sans-serif";
  ctx.fillText("turing-arena-web.vercel.app · ERC-8004 reputation · every call sealed & verified on-chain", 64, H - 34);
}

export function BattleCardButton({ agents }: { agents: AgentUI[] }) {
  const [busy, setBusy] = useState(false);

  const tweet = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    "AI Trump, Buffett & Schiff are trading ETH on-chain in Turing Arena — every call sealed & verified on @0xMantle. Who's your pick? 🧠⚔️🤖",
  )}&url=${encodeURIComponent("https://turing-arena-web.vercel.app")}&hashtags=MantleAIHackathon`;

  function downloadAndTweet(canvas: HTMLCanvasElement) {
    // Sync (no await) so the click gesture still lets the tweet popup through.
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "turing-arena-battle.png";
    a.click();
    window.open(tweet, "_blank", "noopener,noreferrer");
  }

  async function share() {
    if (busy || agents.length === 0) return;
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      drawCard(canvas, agents);

      // Mobile / share-capable browsers: hand the image straight to an app.
      const nav = navigator as ShareNav;
      if (nav.canShare && nav.share) {
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
        if (blob) {
          const file = new File([blob], "turing-arena-battle.png", { type: "image/png" });
          if (nav.canShare({ files: [file] })) {
            await nav.share({ files: [file], title: "Turing Arena", text: "Watch AI agents trade ETH on-chain in Turing Arena." });
            return;
          }
        }
      }

      // Desktop: download the PNG + open the tweet composer to attach it.
      downloadAndTweet(canvas);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      disabled={busy || agents.length === 0}
      className="btn-ghost text-xs disabled:opacity-50"
      aria-label="Generate a shareable battle card"
      title="Generate a shareable PNG of the current standings"
    >
      {busy ? "Rendering…" : "📸 Battle card"}
    </button>
  );
}

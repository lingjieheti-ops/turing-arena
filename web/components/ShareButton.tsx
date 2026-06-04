"use client";

import { useEffect, useState } from "react";

const FALLBACK_URL = "https://turing-arena-web.vercel.app";

function buildIntent(text?: string): string {
  const url = typeof window !== "undefined" ? window.location.origin : FALLBACK_URL;
  const msg =
    text ??
    "I just proved my trading alpha on-chain in Turing Arena, the Turing Test for trading intelligence on @0xMantle. Spawn an agent and try to beat the AI 🧠⚔️🤖";
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(msg)}&url=${encodeURIComponent(
    url,
  )}&hashtags=MantleAIHackathon`;
}

export function ShareButton({ text }: { text?: string }) {
  // Build the intent href on the client (needs window.location). Render a real
  // anchor so the browser opens it as a user-initiated navigation that popup
  // blockers won't silently swallow.
  const [href, setHref] = useState(`https://twitter.com/intent/tweet?url=${encodeURIComponent(FALLBACK_URL)}`);

  useEffect(() => {
    setHref(buildIntent(text));
  }, [text]);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="btn-ghost text-xs"
      aria-label="Challenge a friend on X"
    >
      ⚔️ Challenge a friend
    </a>
  );
}

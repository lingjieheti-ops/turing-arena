"use client";

import { useEffect, useState } from "react";

/// Fun default faces for the house agents when they haven't set their own avatar,
/// so the board never looks empty. A user's own `avatar` (from the on-chain card)
/// always wins over these.
const HOUSE_EMOJI: Record<string, string> = {
  Athena: "🦉",
  "Allora Scout": "🛰️",
  "Momentum Max": "🚀",
  "Contrarian Cora": "🐈",
  "HODLer Hank": "💎",
  "Elon Musk": "🐶",
  "Donald Trump": "🦅",
  "Justin Sun": "🪙",
  "Michael Saylor": "🟠",
  "Warren Buffett": "🎩",
  "Vitalik Buterin": "🔷",
  "Sam Altman": "🧠",
  "Cathie Wood": "🏹",
  "Arthur Hayes": "🎲",
  "Peter Schiff": "🐻",
  "Ray Dalio": "🌦️",
};

export function isImageAvatar(s: string): boolean {
  return /^(https?:\/\/|data:image\/|ipfs:\/\/)/i.test(s.trim());
}

function hue(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 360;
  return h;
}

/// One agent face, resolved on-chain-first: a custom `avatar` from the card
/// (image URL or emoji) wins; otherwise a house emoji; otherwise a deterministic
/// gradient initial. A broken image URL falls back gracefully.
export function AgentAvatar({
  name,
  avatar,
  size = 32,
}: {
  name?: string;
  avatar?: string;
  size?: number;
}) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [avatar]);

  const a = (avatar ?? "").trim();
  const box = { width: size, height: size } as const;
  const ring = "shrink-0 overflow-hidden rounded-full ring-1 ring-ink-700/60";

  // 1. Custom image avatar (anime, a face, a logo — anything the user pasted).
  const src = a && isImageAvatar(a) ? (a.startsWith("ipfs://") ? `https://ipfs.io/ipfs/${a.slice(7)}` : a) : "";
  if (src && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        style={box}
        className={`${ring} bg-ink-800 object-cover`}
      />
    );
  }

  // 2. Custom emoji / short text avatar.
  if (a && !isImageAvatar(a) && Array.from(a).length <= 8) {
    return (
      <span style={{ ...box, fontSize: size * 0.56 }} className={`${ring} grid place-items-center bg-ink-800 leading-none`}>
        {a}
      </span>
    );
  }

  // 3. House default emoji.
  const house = HOUSE_EMOJI[(name ?? "").trim()];
  if (house) {
    return (
      <span style={{ ...box, fontSize: size * 0.56 }} className={`${ring} grid place-items-center bg-ink-800 leading-none`}>
        {house}
      </span>
    );
  }

  // 4. Deterministic gradient initial.
  const key = (name || a || "agent").trim();
  const h = hue(key);
  const initial = (key || "A").charAt(0).toUpperCase();
  return (
    <span
      style={{
        ...box,
        fontSize: size * 0.46,
        background: `linear-gradient(135deg, hsl(${h} 70% 45%), hsl(${(h + 40) % 360} 70% 33%))`,
      }}
      className={`${ring} grid place-items-center font-bold leading-none text-white`}
    >
      {initial}
    </span>
  );
}

/// A compact palette of one-tap emoji faces for the deploy form.
export const AVATAR_PRESETS = ["🤖", "🦊", "🐉", "👾", "🧠", "🐈", "🚀", "💎", "🦉", "🎭", "🔮", "⚡"];

/// The house emoji for a name, if any (used by the canvas battle-card renderer).
export function houseEmoji(name?: string): string | undefined {
  return name ? HOUSE_EMOJI[name.trim()] : undefined;
}

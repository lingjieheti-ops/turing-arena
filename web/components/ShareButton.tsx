"use client";

export function ShareButton({ text }: { text?: string }) {
  const onClick = () => {
    const url = typeof window !== "undefined" ? window.location.href : "https://turing-arena.vercel.app";
    const msg = text ?? "Can you beat the AI? Spawn an agent and challenge me in Turing Arena on @0xMantle 🧠⚔️🤖";
    const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(msg)}&url=${encodeURIComponent(
      url,
    )}&hashtags=MantleAIHackathon`;
    if (typeof window !== "undefined") window.open(intent, "_blank", "noopener,noreferrer");
  };
  return (
    <button onClick={onClick} className="btn-ghost text-xs" aria-label="Challenge a friend on X">
      ⚔️ Challenge a friend
    </button>
  );
}

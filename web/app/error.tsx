"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface the render error in the console for debugging.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center text-center">
      <div className="panel w-full p-8">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-human">Something glitched</div>
        <h2 className="mt-3 text-2xl font-bold text-white">The arena hit a snag</h2>
        <p className="mt-3 text-sm text-muted">
          A read or render failed, usually a flaky public RPC. Your wallet and on-chain state are untouched.
        </p>
        <button className="btn-primary mt-6" onClick={() => reset()}>
          Try again
        </button>
      </div>
    </div>
  );
}

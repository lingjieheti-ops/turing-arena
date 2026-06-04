/// Deterministic, dependency-free helpers shared by the signal adapters.

/// FNV-1a string hash -> [0, 1).
export function hash01(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/// Deterministic pseudo-signal in [-1, 1] for a (source, asset, seed) triple.
export function mockScore(source: string, asset: string, seed: string | number): number {
  return hash01(`${source}:${asset}:${seed}`) * 2 - 1;
}

/// Default seed: the current hour bucket, so live mock signals are stable within
/// a round but evolve over time.
export function hourBucket(now = Date.now()): string {
  return String(Math.floor(now / 3_600_000));
}

export function clamp(x: number, lo = -1, hi = 1): number {
  return Math.max(lo, Math.min(hi, x));
}

/// fetch JSON with a timeout; returns null on any failure.
export async function fetchJson<T = any>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 12_000,
): Promise<T | null> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

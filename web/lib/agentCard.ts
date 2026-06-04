export interface DecodedCard {
  name?: string;
  kind?: "AI" | "HUMAN";
  model?: string;
  signals?: string[];
  strategy?: string;
  persona?: string;
  avatar?: string;
}

const B64_PREFIX = "data:application/json;base64,";
const RAW_PREFIX = "data:application/json,";

/// Decode base64 → UTF-8 so multi-byte glyphs (emoji avatars) survive. Plain
/// `atob` yields a Latin1 string that mangles anything outside ASCII.
function b64ToUtf8(b64: string): string {
  if (typeof atob === "undefined") return Buffer.from(b64, "base64").toString("utf8");
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function decodeAgentCard(uri: string | undefined): DecodedCard {
  if (!uri) return {};
  try {
    if (uri.startsWith(B64_PREFIX)) {
      return JSON.parse(b64ToUtf8(uri.slice(B64_PREFIX.length)));
    }
    if (uri.startsWith(RAW_PREFIX)) {
      return JSON.parse(decodeURIComponent(uri.slice(RAW_PREFIX.length)));
    }
  } catch {
    /* ignore malformed cards */
  }
  return {};
}

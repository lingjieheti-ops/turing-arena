export interface DecodedCard {
  name?: string;
  kind?: "AI" | "HUMAN";
  model?: string;
  signals?: string[];
}

const B64_PREFIX = "data:application/json;base64,";
const RAW_PREFIX = "data:application/json,";

export function decodeAgentCard(uri: string | undefined): DecodedCard {
  if (!uri) return {};
  try {
    if (uri.startsWith(B64_PREFIX)) {
      const b64 = uri.slice(B64_PREFIX.length);
      const json =
        typeof atob !== "undefined" ? atob(b64) : Buffer.from(b64, "base64").toString("utf8");
      return JSON.parse(json);
    }
    if (uri.startsWith(RAW_PREFIX)) {
      return JSON.parse(decodeURIComponent(uri.slice(RAW_PREFIX.length)));
    }
  } catch {
    /* ignore malformed cards */
  }
  return {};
}

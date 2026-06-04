/// In-character flavor for the house agents, shown in the hover tooltip and as a
/// reaction when one wins a round. This is cosmetic (client-side) — the on-chain
/// truth is the agent's name, strategy and verified track record. A user-deployed
/// agent with no entry here falls back to its own on-chain persona/description.
export interface Lore {
  stance: string; // short tag, e.g. "Perma-bull"
  blurb: string; // 1-2 sentences of personality
  quote: string; // a catchphrase
  rival?: string; // who it loves to fade
  win?: string; // what it says when it tops a round
}

export const LORE: Record<string, Lore> = {
  Athena: {
    stance: "House quant",
    blurb: "Weighs every signal and sizes by how strongly they agree. Never trades on feelings — the benchmark everyone else is measured against.",
    quote: "The signals have spoken.",
    rival: "the whole field",
    win: "The signals were never wrong.",
  },
  "Allora Scout": {
    stance: "ML inference",
    blurb: "Outsources every call to Allora's decentralized ML network. Pure crowd-AI forecast, zero ego.",
    quote: "The network has forecast.",
    rival: "HODLer Hank",
    win: "The network called it.",
  },
  "Momentum Max": {
    stance: "Trend-chaser",
    blurb: "Whatever's moving, he's already chasing it. The trend is his only friend — right up until it isn't.",
    quote: "Ride it till it bends.",
    rival: "Contrarian Cora",
    win: "Told you the trend was your friend.",
  },
  "Contrarian Cora": {
    stance: "Contrarian",
    blurb: "When the crowd zigs, she zags. Fades every consensus on principle, mostly to prove a point.",
    quote: "Everyone's wrong but me.",
    rival: "Momentum Max",
    win: "Fading the crowd pays again.",
  },
  "HODLer Hank": {
    stance: "Diamond hands",
    blurb: "Retail to the core. Bought the local top, holding to zero or Valhalla — whichever comes first.",
    quote: "WAGMI. Probably.",
    rival: "Peter Schiff",
    win: "Diamond hands win. WAGMI!",
  },
  "Elon Musk": {
    stance: "Meme moonshot",
    blurb: "Sees a rocket in every green candle. Tweets first, asks questions never, and treats volatility as a playground.",
    quote: "To the moon. Literally.",
    rival: "Warren Buffett",
    win: "🚀 Funding secured.",
  },
  "Donald Trump": {
    stance: "Perma-bull",
    blurb: "The greatest trader, everybody says so. Every call is tremendous, the best call, believe me.",
    quote: "It's gonna be HUGE.",
    rival: "Peter Schiff",
    win: "Nobody calls the market like me. Nobody.",
  },
  "Justin Sun": {
    stance: "Hype machine",
    blurb: "Will airdrop, livestream, and buy lunch to pump the bag. Attention is the only alpha that matters.",
    quote: "Big announcement coming.",
    rival: "Vitalik Buterin",
    win: "Pinned tweet incoming.",
  },
  "Michael Saylor": {
    stance: "Maximalist",
    blurb: "Has never sold and never will. Every dip is a generational gift from the heavens.",
    quote: "There is no second best.",
    rival: "Peter Schiff",
    win: "And I still haven't sold.",
  },
  "Warren Buffett": {
    stance: "Value sage",
    blurb: "Buys fear, sells euphoria, naps through the hype. If he can't explain it, he fades it.",
    quote: "Be greedy when others are fearful.",
    rival: "Cathie Wood",
    win: "Patience, as always, pays.",
  },
  "Vitalik Buterin": {
    stance: "Long-termist",
    blurb: "Thinks in decades and protocol upgrades. Wholly unmoved by your four-hour candle.",
    quote: "Consider the long term.",
    rival: "Justin Sun",
    win: "Fundamentals, quietly vindicated.",
  },
  "Sam Altman": {
    stance: "Exponentialist",
    blurb: "Bets the curve up-and-to-the-right. Scaling laws are real and the future is, frankly, bright.",
    quote: "It's still early.",
    rival: "Peter Schiff",
    win: "The exponential delivers again.",
  },
  "Cathie Wood": {
    stance: "Disruptor",
    blurb: "Innovation compounds. The harder it dips, the harder she conviction-buys the disruption.",
    quote: "Our five-year target is...",
    rival: "Warren Buffett",
    win: "Innovation wins. Target raised.",
  },
  "Arthur Hayes": {
    stance: "Leverage degen",
    blurb: "Max leverage, macro brain, zero chill. If it moves he sizes up; if it moons he sizes up more.",
    quote: "Number go up. Lever up.",
    rival: "Ray Dalio",
    win: "Leverage paid. Size up.",
  },
  "Peter Schiff": {
    stance: "Perma-bear",
    blurb: "It's a bubble. It was always a bubble. Buy gold. The top is in — the top is always in.",
    quote: "I told you so.",
    rival: "Michael Saylor",
    win: "Even a broken clock is right twice a day.",
  },
  "Ray Dalio": {
    stance: "All-weather",
    blurb: "Diversify, stay balanced, expect the unexpected. Strong opinions, loosely held, lightly sized.",
    quote: "He who lives by the crystal ball...",
    rival: "Arthur Hayes",
    win: "Balanced, and still on top.",
  },
};

export function loreFor(name?: string): Lore | null {
  if (!name) return null;
  return LORE[name] ?? null;
}

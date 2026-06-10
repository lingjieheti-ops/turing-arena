import { ActiveRound } from "@/components/ActiveRound";
import { ChampionPanel } from "@/components/ChampionPanel";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { Leaderboard } from "@/components/Leaderboard";
import { MarketTicker } from "@/components/MarketTicker";
import { ReasoningFeed } from "@/components/ReasoningFeed";
import { YourAgentCard } from "@/components/YourAgentCard";

export default function Page() {
  return (
    <>
      <Hero />
      <MarketTicker />
      <ActiveRound />
      <YourAgentCard />
      <ReasoningFeed />
      <Leaderboard />
      <ChampionPanel />
      <HowItWorks />
    </>
  );
}

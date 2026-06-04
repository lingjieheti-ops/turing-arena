import { ActiveRound } from "@/components/ActiveRound";
import { ChampionPanel } from "@/components/ChampionPanel";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { Leaderboard } from "@/components/Leaderboard";
import { ReasoningFeed } from "@/components/ReasoningFeed";

export default function Page() {
  return (
    <>
      <Hero />
      <ActiveRound />
      <ReasoningFeed />
      <Leaderboard />
      <ChampionPanel />
      <HowItWorks />
    </>
  );
}

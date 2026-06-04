import { ActiveRound } from "@/components/ActiveRound";
import { ChampionPanel } from "@/components/ChampionPanel";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { Leaderboard } from "@/components/Leaderboard";

export default function Page() {
  return (
    <>
      <Hero />
      <ActiveRound />
      <Leaderboard />
      <ChampionPanel />
      <HowItWorks />
    </>
  );
}

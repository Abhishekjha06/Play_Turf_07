import { useEffect, useState } from "react";
import { MobileShell } from "@/layout/MobileShell";
import { AppHeader } from "@/layout/AppHeader";
import { BottomNav } from "@/layout/BottomNav";
import { api } from "@/lib/api";
import type { Tournament } from "@/data/seed";
import { TournamentHeroCarousel } from "@/home/TournamentHeroCarousel";
import { tournaments as fallbackTournaments } from "@/data/seed";

const Tournaments = () => {
  const [list, setList] = useState<Tournament[]>([]);
  useEffect(() => {
    // Fall back to seed data on error — mirrors Home.tsx's banner/turf/offer pattern.
    api.listTournaments().then(setList).catch(() => setList(fallbackTournaments));
  }, []);

  return (
    <MobileShell>
      <AppHeader />
      <h1 className="px-4 mt-4 font-display font-extrabold text-2xl">Tournaments</h1>
      <p className="px-4 text-muted2 text-sm">Compete. Win. Repeat.</p>

      <TournamentHeroCarousel
        tournaments={list}
        loop
        autoPlay
        autoPlayInterval={5000}
        showArrows
        showDots
      />

      <BottomNav />
    </MobileShell>
  );
};

export default Tournaments;

import { useEffect, useState } from "react";
import { MobileShell } from "@/layout/MobileShell";
import { AppHeader } from "@/layout/AppHeader";
import { BottomNav } from "@/layout/BottomNav";
import { api } from "@/lib/api";
import type { Tournament } from "@/data/seed";
import { Trophy, MapPin, Calendar, Users } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

const Tournaments = () => {
  const [list, setList] = useState<Tournament[]>([]);
  useEffect(() => { api.listTournaments().then(setList); }, []);
  return (
    <MobileShell>
      <AppHeader />
      <h1 className="px-4 mt-4 font-display font-extrabold text-2xl">Tournaments</h1>
      <p className="px-4 text-muted2 text-sm">Compete. Win. Repeat.</p>

      <div className="px-4 mt-5 flex flex-col gap-3">
        {list.map((t, i) => (
          <motion.article
            key={t.id}
            initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
            className="card-panel rounded-3xl overflow-hidden"
            data-testid={`tournament-${t.id}`}
          >
            <div className="relative h-36">
              <img src={t.image} alt={t.name} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-overlay" />
              <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary text-primary-foreground text-[11px] font-bold">
                <Trophy className="h-3 w-3" /> {t.prize_pool}
              </span>
              <div className="absolute bottom-3 left-3 right-3">
                <h3 className="font-display font-bold text-lg leading-tight">{t.name}</h3>
                <p className="text-soft text-xs line-clamp-1">{t.description}</p>
              </div>
            </div>
            <div className="p-3 grid grid-cols-3 gap-2 text-[11px]">
              <Stat icon={Calendar} label={t.date} />
              <Stat icon={MapPin} label={t.location} />
              <Stat icon={Users} label={`${t.teams} teams`} />
            </div>
            <div className="px-3 pb-3 flex items-center justify-between gap-3">
              <p className="text-sm shrink-0">Entry <span className="neon-text font-bold">₹{t.entry_fee}</span></p>
              <button
                onClick={() => toast.info(`Registration for "${t.name}" coming soon!`)}
                className="bg-primary text-primary-foreground rounded-full px-5 py-2.5 text-sm font-semibold shadow-neon pressable min-h-[44px]"
              >
                Register
              </button>
            </div>
          </motion.article>
        ))}
      </div>
      <BottomNav />
    </MobileShell>
  );
};

function Stat({ icon: Icon, label }: { icon: typeof Trophy; label: string }) {
  return (
    <div className="bg-panel-2 rounded-xl px-2 py-2.5 inline-flex items-center gap-1.5 border border-white/5 min-w-0">
      <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
      <span className="text-soft text-[11px] truncate leading-tight">{label}</span>
    </div>
  );
}

export default Tournaments;

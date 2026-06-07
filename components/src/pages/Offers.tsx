import { useQuery } from "@tanstack/react-query";
import { MobileShell } from "@/layout/MobileShell";
import { AppHeader } from "@/layout/AppHeader";
import { BottomNav } from "@/layout/BottomNav";
import { api } from "@/lib/api";
import type { Offer } from "@/data/seed";
import { motion } from "framer-motion";

const Offers = () => {
  const { data: list = [] } = useQuery<Offer[]>({
    queryKey: ["offers"],
    queryFn: () => api.listOffers(),
    staleTime: 120_000,
  });
  return (
    <MobileShell>
      <AppHeader />
      <h1 className="px-4 mt-4 font-display font-extrabold text-2xl">Offers & Deals</h1>
      <p className="px-4 text-muted2 text-sm">Save big on every match.</p>
      <div className="px-4 mt-5 flex flex-col gap-3 pb-4">
        {list.map((o, i) => (
          <motion.div
            key={o.id}
            initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
            className="relative h-44 rounded-3xl overflow-hidden card-panel"
          >
            <img src={o.image} alt={o.title} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-overlay" />
            <div className="absolute inset-0 p-4 flex flex-col justify-between">
              <span className="self-start inline-flex items-center px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                {o.badge}
              </span>
              <div>
                <h3 className="font-display font-bold text-lg">{o.title}</h3>
                <p className="text-soft text-sm">{o.subtitle}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      <BottomNav />
    </MobileShell>
  );
};

export default Offers;

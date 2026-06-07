import { Link } from "react-router-dom";
import type { Offer } from "@/data/seed";
import { useLuxuryTheme } from "@/luxury/LuxuryThemeProvider";
import { motion } from "framer-motion";
import { ease } from "@/lib/motion";

export function OfferCard({ offer, index = 0 }: { offer: Offer; index?: number }) {
  const { themeId } = useLuxuryTheme();
  const isPremium = themeId === "premium-teal";

  const enterVariant = {
    hidden: { opacity: 0, x: 20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.35, delay: Math.min(index, 5) * 0.07, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
    },
  };

  if (isPremium) {
    return (
      <motion.div
        variants={enterVariant}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        whileTap={{ scale: 0.96 }}
        whileHover={{ y: -4, boxShadow: "0 16px 40px rgba(15,23,42,0.14)" }}
        transition={ease.springGentle}
        style={{ willChange: "transform" }}
      >
        <Link
          to="/offers"
          className="relative shrink-0 w-[80vw] max-w-72 overflow-hidden block"
          style={{ height: "144px", borderRadius: "20px", border: "1px solid #E2E8F0", boxShadow: "0 8px 30px rgba(15,23,42,0.08)" }}
          data-testid={`offer-${offer.id}`}
        >
          <motion.img
            src={offer.image}
            alt={offer.title}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.55, ease: [0.25, 1, 0.5, 1] }}
          />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.62) 100%)" }} />
          <div className="absolute inset-0 p-3 flex flex-col justify-between">
            <span className="self-start inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider"
              style={{ background: "#F59E0B", color: "white" }}>
              {offer.badge}
            </span>
            <div>
              <h4 className="font-semibold leading-tight" style={{ fontSize: "13px", color: "white" }}>{offer.title}</h4>
              <p className="line-clamp-1 mt-0.5" style={{ fontSize: "11px", color: "rgba(255,255,255,0.75)" }}>{offer.subtitle}</p>
              <p className="mt-1 font-bold" style={{ fontSize: "16px", color: "#F59E0B" }}>{offer.discount} OFF</p>
            </div>
          </div>
        </Link>
      </motion.div>
    );
  }

  // Legacy
  return (
    <motion.div
      variants={enterVariant}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      whileTap={{ scale: 0.96 }}
      whileHover={{ y: -4 }}
      transition={ease.springGentle}
      style={{ willChange: "transform" }}
    >
      <Link
        to="/offers"
        className="relative shrink-0 w-[80vw] max-w-72 h-36 rounded-2xl overflow-hidden card-panel block"
        data-testid={`offer-${offer.id}`}
      >
        <motion.img
          src={offer.image}
          alt={offer.title}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.55, ease: [0.25, 1, 0.5, 1] }}
        />
        <div className="absolute inset-0 bg-gradient-overlay" />
        <div className="absolute inset-0 p-3 flex flex-col justify-between">
          <span className="self-start inline-flex items-center px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold tracking-wider">
            {offer.badge}
          </span>
          <div>
            <h4 className="font-semibold text-sm leading-tight">{offer.title}</h4>
            <p className="text-[11px] text-soft line-clamp-1">{offer.subtitle}</p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

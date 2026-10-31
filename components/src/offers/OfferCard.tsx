import { Link } from "react-router-dom";
import type { Offer } from "@/data/seed";
import { motion } from "framer-motion";
import { ease } from "@/lib/motion";

/**
 * Offer card — ONE shared UI for every theme. Text over the photo stays white
 * (semantic constant); the badge/discount colors come from the theme's badge
 * tokens (gold on Premium Teal, emerald on AMOLED Black).
 */
export function OfferCard({ offer, index = 0 }: { offer: Offer; index?: number }) {
  const enterVariant = {
    hidden: { opacity: 0, x: 20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.35, delay: Math.min(index, 5) * 0.07, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
    },
  };

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
        className="relative shrink-0 w-[80vw] max-w-72 overflow-hidden block h-36 rounded-[20px]"
        style={{ border: "1px solid hsl(var(--border))", boxShadow: "var(--shadow-card)" }}
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
          <span
            className="self-start inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider"
            style={{ background: "var(--l-badge-bg)", color: "var(--l-badge-text)" }}
          >
            {offer.badge}
          </span>
          <div>
            <h4 className="font-semibold leading-tight text-sm text-white">{offer.title}</h4>
            <p className="line-clamp-1 mt-0.5 text-xs text-white/75">{offer.subtitle}</p>
            <p className="mt-1 font-bold text-base" style={{ color: "var(--l-badge-text)" }}>
              {offer.discount} OFF
            </p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

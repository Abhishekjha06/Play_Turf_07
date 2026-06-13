import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MobileShell } from "@/layout/MobileShell";
import { AppHeader } from "@/layout/AppHeader";
import { BottomNav } from "@/layout/BottomNav";
import { SearchBar } from "@/home/SearchBar";
import { HeroCarousel } from "@/home/HeroCarousel";
import { CategoryPills } from "@/home/CategoryPills";
import { SectionHeader } from "@/home/SectionHeader";
import TurfCard from "@/turf/TurfCard";
import { CompactTurfCard } from "@/turf/CompactTurfCard";
import { OfferCard } from "@/offers/OfferCard";
import { BookingRow } from "@/booking/BookingRow";
import { TurfCardSkeleton, BookingRowSkeleton } from "@/ui/Shimmer";
import { getPopularTurfs, getNearbyTurfs, getAllTurfs } from "@/services/turfService";
import { getOffers } from "@/services/offerService";
import { api } from "@/lib/api";
import type { Banner, Booking, Turf, Offer } from "@/data/seed";
import { toast } from "sonner";
import { pageEnter, sectionReveal, staggerContainer, fadeSlideUp } from "@/lib/motion";
import { trackEvent } from "@/lib/analytics";

const cityCoords: Record<string, { lat: number; lon: number }> = {
  Bangalore: { lat: 12.9716, lon: 77.5946 },
  Mumbai: { lat: 19.076, lon: 72.8777 },
  Hyderabad: { lat: 17.385, lon: 78.4867 },
  Delhi: { lat: 28.6139, lon: 77.209 },
};

function closestCity(lat: number, lon: number, cities: string[]) {
  return cities.reduce(
    (best, city) => {
      const coords = cityCoords[city];
      if (!coords) return best;
      const score = Math.hypot(coords.lat - lat, coords.lon - lon);
      return score < best.score ? { city, score } : best;
    },
    { city: cities[0] || "", score: Number.POSITIVE_INFINITY },
  ).city;
}

const Home = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const q = params.get("q") || "";
  const nearby = params.get("nearby") === "1";
  
  const selectedCity = useMemo(() => {
    return params.get("city") || localStorage.getItem("play_turf_selected_city") || "";
  }, [params]);

  const selectedArea = useMemo(() => {
    return params.get("area") || localStorage.getItem("play_turf_selected_area") || "";
  }, [params]);

  const selectedSport = params.get("sport") || "";
  const selectedAmenity = params.get("amenity") || "";
  const maxPrice = params.get("maxPrice") || "";
  const minRating = params.get("minRating") || "";
  const openNow = params.get("openNow") === "1";

  // Sync localStorage with URL search params on mount or param updates
  useEffect(() => {
    const cityInUrl = params.get("city");
    const areaInUrl = params.get("area");
    const cityInStore = localStorage.getItem("play_turf_selected_city");
    const areaInStore = localStorage.getItem("play_turf_selected_area");

    if (!cityInUrl && !areaInUrl && (cityInStore || areaInStore)) {
      const next = new URLSearchParams(params);
      if (cityInStore) next.set("city", cityInStore);
      if (areaInStore) next.set("area", areaInStore);
      navigate(`/?${next.toString()}`, { replace: true });
    }
  }, [params, navigate]);

  // ── Section data via service layer (mock → Supabase ready) ────────
  const [banners, setBanners] = useState<Banner[]>([]);
  const [allTurfs, setAllTurfs] = useState<Turf[]>([]);
  const [popular, setPopular] = useState<Turf[]>([]);
  const [near, setNear] = useState<Turf[]>([]);
  const [results, setResults] = useState<Turf[] | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [upcoming, setUpcoming] = useState<Booking[]>([]);
  const [locating, setLocating] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    trackEvent("Landing Page Viewed");
    void Promise.all([
      // Banners & bookings still use the legacy api (no service yet)
      api.listBanners().then(setBanners),
      api.upcomingBookings().then(setUpcoming),
      // Turf & offer data via the new service layer
      getAllTurfs().then(setAllTurfs),
      getPopularTurfs(10).then(setPopular),
      getNearbyTurfs(null, 10).then(setNear),
      getOffers(10).then(setOffers),
    ]);
  }, []);

  // ── Memoized filter options ────────────────────────────────────────
  const filterOpts = useMemo(() => ({
    q,
    city: selectedCity,
    area: selectedArea,
    sport: selectedSport,
    amenity: selectedAmenity,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    minRating: minRating ? Number(minRating) : undefined,
    openNow,
    userLocation: userLocation || undefined,
  }), [q, selectedCity, selectedArea, selectedSport, selectedAmenity, maxPrice, minRating, openNow, userLocation]);

  const hasActiveFilter = !!(q || selectedCity || selectedArea || selectedSport || selectedAmenity || maxPrice || minRating || openNow);

  // ── Search / filter logic ─────────────────────────────────────────
  useEffect(() => {
    if (hasActiveFilter)
      api.listTurfs(filterOpts).then(setResults);
    else if (nearby)
      api.listTurfs({ nearby: true, userLocation: userLocation || undefined }).then(setResults);
    else setResults(null);
  }, [hasActiveFilter, nearby, filterOpts, userLocation]);


  const updateLocation = useCallback((city: string, area = "") => {
    const next = new URLSearchParams(params);
    next.delete("nearby");
    if (city) {
      next.set("city", city);
      localStorage.setItem("play_turf_selected_city", city);
    } else {
      next.delete("city");
      localStorage.removeItem("play_turf_selected_city");
    }
    if (area) {
      next.set("area", area);
      localStorage.setItem("play_turf_selected_area", area);
    } else {
      next.delete("area");
      localStorage.removeItem("play_turf_selected_area");
    }
    navigate(`/?${next.toString()}`);
  }, [params, navigate]);

  useEffect(() => {
    if (!nearby || selectedCity || !navigator.geolocation || allTurfs.length === 0) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const cities = Array.from(new Set(allTurfs.map((t) => t.city)));
        const city = closestCity(position.coords.latitude, position.coords.longitude, cities);
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocating(false);
        if (city) {
          toast.success(`Showing turfs near ${city}`);
          updateLocation(city, "");
        }
      },
      () => {
        setLocating(false);
        toast.error("Location access denied. Please select a location manually.");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }, [nearby, selectedCity, allTurfs, updateLocation]);

  const setParam = useCallback((key: string, value: string | boolean) => {
    const next = new URLSearchParams(params);
    next.delete("nearby");
    if (value === "" || value === false) next.delete(key);
    else next.set(key, value === true ? "1" : String(value));
    navigate(`/?${next.toString()}`);
  }, [params, navigate]);

  const requestNearMe = useCallback(() => {
    const next = new URLSearchParams(params);
    next.set("nearby", "1");
    next.delete("city");
    next.delete("area");
    next.delete("q");
    navigate(`/?${next.toString()}`);
  }, [params, navigate]);

  return (
    <MobileShell>
      <AppHeader />
      <SearchBar />

      <AnimatePresence mode="wait">
        {results ? (
          <motion.div
            key="results"
            variants={pageEnter}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <SectionHeader title={q ? `Results for "${q}"` : selectedArea ? selectedArea : selectedCity ? selectedCity : "Near you"} />
            <motion.div
              className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3 px-4"
              variants={staggerContainer(0.06)}
              initial="hidden"
              animate="visible"
            >
              {results.map((t, i) => (<TurfCard key={t.id} turf={t} index={i} userLocation={userLocation} />))}
              {results.length === 0 && (
                <motion.p
                  variants={fadeSlideUp}
                  className="col-span-2 text-sm text-muted2 text-center py-8"
                >
                  No turfs found.
                </motion.p>
              )}
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="home"
            variants={pageEnter}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <HeroCarousel banners={banners} />
            <CategoryPills
              turfs={allTurfs}
              city={selectedCity}
              area={selectedArea}
              locating={locating}
              onCity={(city) => updateLocation(city, "")}
              onArea={(area) => updateLocation(selectedCity, area)}
              onNearMe={requestNearMe}
            />

            {/* ── Popular Turfs ── */}
            <motion.section
              variants={sectionReveal}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.05 }}
            >
              <SectionHeader title="Popular Turfs" to="/?nearby=1" action="See all" />
              <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3 px-4">
                {popular.length === 0
                  ? [0, 1, 2, 3].map((k) => <TurfCardSkeleton key={k} />)
                  : popular.slice(0, 4).map((t, i) => (
                    <TurfCard key={t.id} turf={t} index={i} userLocation={userLocation} />
                  ))}
              </div>
            </motion.section>

            {/* ── Top Picks Near You ── */}
            <motion.section
              variants={sectionReveal}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.05 }}
            >
              <SectionHeader title="Top Picks Near You" to="/?nearby=1" action="See all" />
              <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-1">
                {near.map((t) => (
                  <CompactTurfCard key={t.id} turf={t} userLocation={userLocation} />
                ))}
              </div>
            </motion.section>

            {/* ── Offers & Deals ── */}
            <motion.section
              variants={sectionReveal}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.05 }}
            >
              <SectionHeader title="Offers & Deals" to="/offers" action="See all" />
              <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-1">
                {offers.map((o, i) => (
                  <OfferCard key={o.id} offer={o} index={i} />
                ))}
              </div>
            </motion.section>

            {/* ── Upcoming Bookings ── */}
            {upcoming.length > 0 && (
              <motion.section
                variants={sectionReveal}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.05 }}
              >
                <SectionHeader title="Upcoming Bookings" to="/bookings" action="See all" />
                <motion.div
                  variants={staggerContainer(0.08)}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  className="px-4 flex flex-col gap-2"
                >
                  {upcoming.slice(0, 3).map((b) => (
                    <motion.div key={b.id} variants={fadeSlideUp}>
                      <BookingRow booking={b} />
                    </motion.div>
                  ))}
                </motion.div>
              </motion.section>
            )}

            <div className="h-6" />
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </MobileShell>
  );
};

export default Home;

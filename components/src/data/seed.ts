import turf1 from "@/assets/turf-1.webp";
import turf2 from "@/assets/turf-2.webp";
import turf3 from "@/assets/turf-3.webp";
import turf4 from "@/assets/turf-4.webp";
import turf5 from "@/assets/turf-5.webp";
import turf6 from "@/assets/turf-6.webp";
import heroNight from "@/assets/hero-night-turf.webp";
import heroBox from "@/assets/hero-box-cricket.webp";
import heroTrophy from "@/assets/hero-tournament.webp";
import offerWeekend from "@/assets/offer-weekend.webp";
import offerHappy from "@/assets/offer-happy-hours.webp";
import offerGroup from "@/assets/offer-group.webp";

export type Turf = {
  id: string;
  name: string;
  city: string;
  address: string;
  lat?: number;
  lng?: number;
  image: string;
  gallery: string[];
  rating: number;
  timing: string;
  price_per_hour: number;
  sport_types: string[];
  amenities: string[];
  videos?: string[];
  description: string;
  is_popular: boolean;
  is_nearby: boolean;
};

export type Review = {
  id: string;
  turf_id: string;
  user_id: string;
  user_name: string;
  rating: number;
  comment: string;
  created_at: string;
};

export type Banner = {
  id: string;
  title: string;
  highlight: string;
  subtitle: string;
  image: string;
  badge: string;
  cta_text: string;
  cta_link: string;
  order: number;
};

export type Offer = {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  image: string;
  discount: string;
};

export type Tournament = {
  id: string;
  name: string;
  sport: string;
  location: string;
  image: string;
  date: string;
  prize_pool: string;
  teams: number;
  entry_fee: number;
  description: string;
};

export type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";

export type Booking = {
  id: string;
  user_id: string;
  turf_id: string;
  turf_name: string;
  turf_image: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string;
  hours: number;
  amount: number;
  status: BookingStatus;
  payment_id: string | null;
  created_at: string;
};

export type User = {
  user_id: string;
  email: string;
  name: string;
  picture: string;
  is_admin: boolean;
  role: string;
};

export const banners: Banner[] = [
  {
    id: "ban_1",
    title: "Play Anytime",
    highlight: "Anytime",
    subtitle: "Book premium turfs in under a minute.",
    image: heroNight,
    badge: "FEATURED",
    cta_text: "Book Now",
    cta_link: "/turf/turf_1",
    order: 1,
  },
  {
    id: "ban_2",
    title: "Floodlit Nights",
    highlight: "Nights",
    subtitle: "Stadium lights. Rooftop turfs. Pure vibe.",
    image: heroBox,
    badge: "NIGHT MODE",
    cta_text: "Explore",
    cta_link: "/turf/turf_3",
    order: 2,
  },
  {
    id: "ban_3",
    title: "Tournaments are LIVE",
    highlight: "LIVE",
    subtitle: "Compete with squads. Win prize pools.",
    image: heroTrophy,
    badge: "TOURNAMENT",
    cta_text: "Join",
    cta_link: "/tournaments",
    order: 3,
  },
];

export const turfs: Turf[] = [
  {
    id: "turf_1",
    name: "Greenfield Arena",
    city: "Virar",
    address: "Indiranagar, Virar",
    lat: 12.9784,
    lng: 77.6408,
    image: turf1,
    gallery: [turf1, turf2, turf6],
    rating: 4.8,
    timing: "06:00 AM – 11:00 PM",
    price_per_hour: 1200,
    sport_types: ["Football", "Futsal"],
    amenities: ["Floodlights", "Parking", "Washroom", "Drinking water"],
    description: "Premium 5-a-side floodlit turf in the heart of Indiranagar.",
    is_popular: true,
    is_nearby: true,
  },
  {
    id: "turf_2",
    name: "Skyline Rooftop Turf",
    city: "Mumbai",
    address: "Lower Parel, Mumbai",
    lat: 18.9936,
    lng: 72.8258,
    image: turf2,
    gallery: [turf2, turf1],
    rating: 4.7,
    timing: "06:00 AM – 12:00 AM",
    price_per_hour: 1500,
    sport_types: ["Football"],
    amenities: ["Floodlights", "Cafe", "Locker", "Parking"],
    description: "Rooftop turf with skyline views and cafe lounge.",
    is_popular: true,
    is_nearby: false,
  },
  {
    id: "turf_3",
    name: "BoxCric Cage",
    city: "Vasai",
    address: "Gachibowli, Vasai",
    lat: 17.4401,
    lng: 78.3489,
    image: turf3,
    gallery: [turf3, turf4],
    rating: 4.6,
    timing: "06:00 AM – 11:00 PM",
    price_per_hour: 900,
    sport_types: ["Cricket"],
    amenities: ["Nets", "Floodlights", "Washroom"],
    description: "Box cricket arena with pro-grade matting and nets.",
    is_popular: true,
    is_nearby: true,
  },
  {
    id: "turf_4",
    name: "Futsal Hub",
    city: "Nalasopara",
    address: "Saket, Nalasopara",
    lat: 28.5245,
    lng: 77.2066,
    image: turf4,
    gallery: [turf4, turf6],
    rating: 4.5,
    timing: "07:00 AM – 11:00 PM",
    price_per_hour: 1100,
    sport_types: ["Futsal", "Football"],
    amenities: ["AC", "Locker", "Cafe"],
    description: "Indoor futsal arena, AC, FIFA-grade flooring.",
    is_popular: true,
    is_nearby: false,
  },
  {
    id: "turf_5",
    name: "Hilltop Grounds",
    city: "Virar",
    address: "Whitefield, Virar",
    lat: 12.9698,
    lng: 77.75,
    image: turf5,
    gallery: [turf5],
    rating: 4.9,
    timing: "05:30 AM – 10:00 PM",
    price_per_hour: 1800,
    sport_types: ["Football"],
    amenities: ["7-a-side", "Parking", "Washroom"],
    description: "Scenic 7-a-side ground with mountain backdrop.",
    is_popular: false,
    is_nearby: true,
  },
  {
    id: "turf_6",
    name: "Arena 360",
    city: "Mumbai",
    address: "Andheri West, Mumbai",
    lat: 19.1364,
    lng: 72.8296,
    image: turf6,
    gallery: [turf6, turf1],
    rating: 4.7,
    timing: "06:00 AM – 12:00 AM",
    price_per_hour: 1400,
    sport_types: ["Football", "Basketball"],
    amenities: ["AC", "LED", "Locker"],
    description: "Hybrid indoor arena for football and basketball.",
    is_popular: false,
    is_nearby: true,
  },
  {
    id: "turf_7",
    name: "PitchPro Center",
    city: "Vasai",
    address: "Dwarka, Vasai",
    lat: 28.5921,
    lng: 77.046,
    image: turf1,
    gallery: [turf1],
    rating: 4.4,
    timing: "06:00 AM – 11:00 PM",
    price_per_hour: 1000,
    sport_types: ["Football"],
    amenities: ["Floodlights", "Parking"],
    description: "Reliable neighborhood turf with great lighting.",
    is_popular: false,
    is_nearby: false,
  },
  {
    id: "turf_8",
    name: "Striker's Den",
    city: "Nalasopara",
    address: "Madhapur, Nalasopara",
    lat: 17.4483,
    lng: 78.3915,
    image: turf4,
    gallery: [turf4],
    rating: 4.5,
    timing: "06:00 AM – 11:00 PM",
    price_per_hour: 1100,
    sport_types: ["Football", "Futsal"],
    amenities: ["AC", "Cafe"],
    description: "Premium indoor futsal with cafe.",
    is_popular: false,
    is_nearby: false,
  },
];

export const offers: Offer[] = [
  {
    id: "off_1",
    title: "Weekend Smash",
    subtitle: "20% off on Sat & Sun bookings",
    badge: "20% OFF",
    image: offerWeekend,
    discount: "20%",
  },
  {
    id: "off_2",
    title: "Happy Hours",
    subtitle: "50% off slots before 8AM",
    badge: "50% OFF",
    image: offerHappy,
    discount: "50%",
  },
  {
    id: "off_3",
    title: "Squad Up",
    subtitle: "Book 5, get 1 hour free",
    badge: "BOOK 5 GET 1",
    image: offerGroup,
    discount: "1 free",
  },
];

export const tournaments: Tournament[] = [
  {
    id: "tnt_1",
    name: "City Champions Cup",
    sport: "Football",
    location: "Bangalore",
    image: heroTrophy,
    date: "2026-05-24",
    prize_pool: "₹50,000",
    teams: 16,
    entry_fee: 2500,
    description: "16-team knockout. Glory and prize pool await.",
  },
  {
    id: "tnt_2",
    name: "Box Cricket Showdown",
    sport: "Cricket",
    location: "Hyderabad",
    image: heroBox,
    date: "2026-06-08",
    prize_pool: "₹30,000",
    teams: 12,
    entry_fee: 1500,
    description: "Floodlit box cricket. T6 format. Fast & furious.",
  },
  {
    id: "tnt_3",
    name: "Weekend League",
    sport: "Futsal",
    location: "Mumbai",
    image: heroNight,
    date: "2026-05-30",
    prize_pool: "₹20,000",
    teams: 8,
    entry_fee: 1200,
    description: "Round-robin futsal league across two Sundays.",
  },
];

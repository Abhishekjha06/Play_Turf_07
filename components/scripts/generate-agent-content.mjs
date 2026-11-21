/**
 * Generates api/agent-content.json — the route → content map consumed by the
 * /api/serve serverless function (real 404s, markdown negotiation, crawler
 * HTML). Only routes backed by REAL data or REAL app pages are emitted, so
 * the function can answer 404 (correct HTTP status) for everything else.
 *
 * Wired as part of the prebuild (after the sitemap).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { siteOrigin, assertProductionOrigin, buildRuntimeSeoConfig, canonicalizeUrl } from "../src/lib/seo-engine/canonical.shared.mjs";
import { resolveSeoFlags } from "../src/config/seo-engine.config.mjs";
import { buildTurfJsonLd, buildBreadcrumbJsonLd } from "../src/lib/seo-engine/jsonld.turf.shared.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const apiDir = path.resolve(root, "..", "api");
const trust = JSON.parse(fs.readFileSync(path.resolve(root, "src", "data", "trust-content.json"), "utf8"));
const blogPosts = JSON.parse(fs.readFileSync(path.resolve(root, "src", "data", "blogPosts.json"), "utf8"));

const env = { ...readViteEnv(), ...process.env }; // readViteEnv is a hoisted function declaration
// Amendment 2: ONE origin source + production build guard (*.vercel.app fails).
const ORIGIN = siteOrigin(env);
assertProductionOrigin(env);

function readViteEnv() {
  const env = {};
  for (const file of [path.resolve(root, ".env.local"), path.resolve(root, ".env")]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const sportOk = (s) => /^[a-z][a-z0-9 &-]{1,30}$/i.test(s) && !/test|demo|sample|debug/i.test(s);

async function fetchTurfs() {
  const env = { ...readViteEnv(), ...process.env };
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) return [];
  // Amendment 1: published-only, with graceful degradation before migration
  // 001 adds the status column to the live DB.
  const attempt = async (filtered) => {
    const qs = filtered ? "select=*&status=eq.published" : "select=*";
    const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/turfs?${qs}`, {
      headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}` },
    });
    if (!res.ok) throw new Error(String(res.status) + (filtered ? " (filtered)" : ""));
    return res.json();
  };
  try {
    return await attempt(true);
  } catch (err) {
    if (!/\(filtered\)/.test(err.message)) {
      console.warn(`⚠ agent-content: could not fetch venues (${err.message}) — venue routes omitted this build.`);
      return [];
    }
    if (resolveSeoFlags(env).allowUnfilteredTurfsFallback) {
      console.warn("⚠ agent-content: SEO_ALLOW_UNFILTERED_TURFS=1 — falling back to unfiltered read (pre-migration mode).");
      try {
        return await attempt(false);
      } catch (err2) {
        console.warn(`⚠ agent-content: could not fetch venues (${err2.message}) — venue routes omitted this build.`);
        return [];
      }
    }
    // Item 1: fail loud by default.
    console.error("✗ agent-content: turfs.status unavailable — apply supabase_seo_001_foundation.sql (or set SEO_ALLOW_UNFILTERED_TURFS=1).");
    process.exit(1);
  }
}

const routes = {};

function addRoute(path_, data) {
  routes[path_] = data;
}

// ── Homepage ───────────────────────────────────────────────────────────────
addRoute("/", {
  robots: "index",
  title: "PlayTurf – Online Cricket & Sports Turf Booking Platform",
  description:
    "PlayTurf is an online sports turf booking platform: discover cricket, football, futsal and box-cricket turfs near you, check live slot availability, and book courts by the hour — plus open games to join and split costs.",
  h1: "PlayTurf – Discover and Book Sports Turfs Online",
  sections: [
    { h2: "Find Sports Turfs Near You", body: "PlayTurf lists sports venues with their location, facilities, operating hours and hourly rates. Browse turfs by city, filter by sport, and open a venue page for photos, amenities and genuine player reviews. Discovery pages are built from the platform's live venue database — cities and sports appear only when venues actually exist." },
    { h2: "Book Cricket and Football Turfs", body: "Venues on PlayTurf commonly offer football, cricket, futsal and box-cricket courts. Pick your sport, compare venues and hourly prices, and reserve a specific court for a specific hour. Multi-hour bookings reserve consecutive slots in one go, so nobody can take the hour in between." },
    { h2: "Simple Online Turf Booking", body: "Choose a date, pick a free start slot, select a court, set your duration (1 to 12 hours) and confirm. You receive a booking ID and a downloadable ticket to show at the venue. Bookings can be cancelled within a short window right after confirmation." },
    { h2: "Check Turf Availability and Time Slots", body: "Every venue shows real-time slot availability for the selected date. Booked slots are marked unavailable, venues with several courts show availability per court, and reservations pending payment expire automatically so stale holds never block a free slot." },
    { h2: "Manage Your Sports Bookings", body: "Player accounts keep your booking history: upcoming and past sessions, cancellations, and downloadable tickets. Open Games let you join games hosted by other players and pay your share of the court instead of the full slot price." },
    { h2: "Why Use PlayTurf?", body: "Live availability instead of phone calls, transparent hourly pricing set by venues, instant confirmation with a booking ID, and open games for solo players. PlayTurf distinguishes platform-operated venues from independent partner venues — partner facilities are never presented as PlayTurf-owned." },
    {
      h2: "Frequently Asked Questions",
      body: [
        "What is PlayTurf? An online sports turf discovery and booking platform for five-a-side football, cricket, futsal and more.",
        "How can I book a cricket turf? Open a cricket venue, pick a date and a free slot, choose the court and confirm — you get an instant booking ID.",
        "Can I book multiple hours? Yes — up to 12 consecutive hours in a single booking.",
        "How do I check turf availability? Each venue page shows live slot availability for the date you pick.",
        "How can I manage my booking? Open it from My Bookings to view, download the ticket or cancel within the allowed window.",
        "How can I contact PlayTurf? Use the in-app feedback channel — see /contact for details.",
      ],
    },
  ],
  links: [
    ["Turfs by city", "/turfs"], ["Sports directory", "/sports"], ["Open Games", "/open-games"],
    ["Playing guides", "/blog"], ["About", "/about"], ["Contact", "/contact"], ["Privacy", "/privacy"],
    ["Sitemap", "/sitemap.xml"], ["Agent documentation", "/llms.txt"],
  ],
});

// ── Trust pages ────────────────────────────────────────────────────────────
for (const key of ["about", "contact", "privacy"]) {
  const page = trust[key];
  addRoute(`/${key}`, {
    robots: "index",
    title: `${page.title} | PlayTurf`,
    description: page.description,
    h1: page.title,
    sections: page.sections,
    links: [["Homepage", "/"], ["Sitemap", "/sitemap.xml"], ["Agent documentation", "/llms.txt"]],
  });
}

// ── Blog ───────────────────────────────────────────────────────────────────
addRoute("/blog", {
  robots: "index",
  title: "Playing Guides — Turf Booking Tips | PlayTurf",
  description: "Practical guides for booking and playing on sports turfs: how to book, what to bring, and when slots are cheapest.",
  h1: "Playing Guides",
  sections: blogPosts.map((p) => ({ h2: p.title, body: p.answer })),
  links: [["Homepage", "/"], ...blogPosts.map((p) => [p.title, `/blog/${p.slug}`])],
});
for (const p of blogPosts) {
  addRoute(`/blog/${p.slug}`, {
    robots: "index",
    title: `${p.title} | PlayTurf`,
    description: p.description,
    h1: p.title,
    sections: [{ h2: "Quick answer", body: p.answer }, ...p.sections],
    links: [["All guides", "/blog"], ["Homepage", "/"]],
  });
}

// ── Discovery pages ────────────────────────────────────────────────────────
addRoute("/turfs", {
  robots: "index",
  title: "Browse Sports Turfs by City — PlayTurf",
  description: "Every sports turf listed on PlayTurf, grouped by city: football grounds, cricket pitches, futsal and box-cricket courts with hourly rates and live slot availability.",
  h1: "Browse Sports Turfs",
  sections: [{ h2: "How discovery works", body: "Venues are grouped by real cities from the live database. Each venue page lists photos, sports, facilities, hourly rates and reviews. Pages appear for cities and sports only when real venues exist." }],
  links: [["Open Games", "/open-games"], ["Sports directory", "/sports"], ["Homepage", "/"]],
});
addRoute("/sports", {
  robots: "index",
  title: "Book Sports by Type — Football, Cricket, Futsal & More | PlayTurf",
  description: "Find turfs bookable by the hour for each sport. Pick a sport to see venues, city coverage and hourly rates.",
  h1: "Book by Sport",
  sections: [{ h2: "Sports on PlayTurf", body: "Sports pages are derived from the sports each listed venue actually offers — commonly football, cricket, futsal and basketball. Each sport links to city-specific pages with real venues." }],
  links: [["Turfs by city", "/turfs"], ["Homepage", "/"]],
});
addRoute("/open-games", {
  robots: "index",
  title: "Open Games — Join & Split Court Costs | PlayTurf",
  description: "Join open games hosted by other players — football, cricket and more. Pay your share of the court instead of the full booking.",
  h1: "Open Games",
  sections: [{ h2: "How Open Games work", body: "A host opens a slot at a venue, players join, and everyone pays their share of the court fee. Private games require host approval. Live listings update in real time." }],
  links: [["Turfs", "/turfs"], ["Homepage", "/"]],
});

// ── Venue/city/sport pages from live data ─────────────────────────────────
const turfs = await fetchTurfs();

// Phase 2 (item 7): per-turf JSON-LD built by the SHARED builder — the same
// function the SPA uses — so bot HTML and SPA emit identical markup. Reviews
// are fetched for the real aggregate; empty reviews → NO rating markup at all.
let reviewsByTurf = new Map();
try {
  const revEnv = { ...readViteEnv(), ...process.env };
  const res = await fetch(`${revEnv.VITE_SUPABASE_URL}/rest/v1/reviews?select=turf_id,rating,comment,user_name,created_at`, {
    headers: { apikey: revEnv.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${revEnv.VITE_SUPABASE_ANON_KEY}` },
  });
  if (res.ok) {
    for (const r of await res.json()) {
      if (!reviewsByTurf.has(r.turf_id)) reviewsByTurf.set(r.turf_id, []);
      reviewsByTurf.get(r.turf_id).push(r);
    }
  }
} catch {
  // reviews unavailable → routes simply carry no rating markup (never fabricate)
}

const byCity = new Map();
for (const t of turfs) {
  const city = (t.city || "").trim();
  if (!city) continue;
  if (!byCity.has(city)) byCity.set(city, []);
  byCity.get(city).push(t);
}

for (const [city, list] of byCity) {
  const citySlug = slugify(city);
  const priceMin = Math.min(...list.map((t) => t.price_per_hour).filter(Boolean));
  addRoute(`/turfs/${citySlug}`, {
    robots: "index",
    title: `Sports Turfs in ${city} — Book by the Hour | PlayTurf`,
    description: `${list.length} sports ${list.length === 1 ? "turf" : "turfs"} in ${city}. See hourly rates from ₹${priceMin}, check live slot availability and book instantly.`,
    h1: `Sports Turfs in ${city}`,
    sections: [{ h2: "Venues in " + city, body: list.map((t) => `${t.name} — ${(t.sport_types || []).join(", ")} — ₹${t.price_per_hour}/hour — ${t.address || city}`).join("\n\n") }],
    links: [["All turfs", "/turfs"], ["Open games", "/open-games"], ["Homepage", "/"]],
  });

  for (const t of list) {
    const slug = [slugify(t.name), slugify(t.id)].filter(Boolean).join("-");
    const abs = (p) => canonicalizeUrl(`${ORIGIN}${p}`);
    const jsonld = [
      buildTurfJsonLd(
        { ...t, slug },
        reviewsByTurf.get(t.id) || [],
        { absoluteUrl: abs }
      ),
      buildBreadcrumbJsonLd(
        [["Home", "/"], ["Turfs", "/turfs"], [city, `/turfs/${citySlug}`], [t.name, `/turf/${slug}`]],
        { absoluteUrl: abs }
      ),
    ];
    addRoute(`/turf/${slug}`, {
      robots: "index",
      title: `${t.name} — ${(t.sport_types || ["Sports"])[0]} Turf in ${city} | PlayTurf`,
      description: `Book ${t.name} in ${city} from ₹${t.price_per_hour}/hour. ${(t.sport_types || []).join(", ")} courts, ${(t.amenities || []).slice(0, 4).join(", ")}. Live slot availability and instant booking.`,
      h1: t.name,
      sections: [
        { h2: "Venue details", body: `${t.name} is a sports turf in ${city}. Address: ${t.address || city}. Operating hours: ${t.timing || "—"}.` },
        { h2: "Sports and facilities", body: `Sports offered: ${(t.sport_types || []).join(", ") || "—"}. Facilities: ${(t.amenities || []).join(", ") || "—"}.` },
        { h2: "Booking", body: `Hourly rate: ₹${t.price_per_hour} per hour, set by the venue. Choose a date and a free slot on the venue page; consecutive hours can be reserved together. Payments currently use a simulated checkout while a live gateway is integrated.` },
      ],
      links: [["Turfs in " + city, `/turfs/${citySlug}`], ["All turfs", "/turfs"], ["Homepage", "/"]],
      jsonld,
    });
  }

  const sports = new Set(list.flatMap((t) => t.sport_types || []).filter(sportOk));
  for (const s of sports) {
    const sportVenues = list.filter((t) => (t.sport_types || []).includes(s));
    addRoute(`/sports/${slugify(s)}/${citySlug}`, {
      robots: "index",
      title: `${s} Turfs in ${city} — Book by the Hour | PlayTurf`,
      description: `${sportVenues.length} ${s.toLowerCase()} ${sportVenues.length === 1 ? "turf" : "turfs"} in ${city} with hourly rates from ₹${Math.min(...sportVenues.map((t) => t.price_per_hour).filter(Boolean))}. Live availability and instant booking.`,
      h1: `${s} Turfs in ${city}`,
      sections: [{ h2: `${s} venues`, body: sportVenues.map((t) => `${t.name} — ₹${t.price_per_hour}/hour — ${t.address || city}`).join("\n\n") }],
      links: [["All sports", "/sports"], ["Turfs in " + city, `/turfs/${citySlug}`], ["Homepage", "/"]],
    });
  }
}

// ── Valid browser-only routes (never 404, never indexed) ──────────────────
const knownSpaPaths = [
  "/login", "/signup", "/forgot-password", "/bookings", "/more", "/avatar", "/theme",
  "/tournaments", "/offers", "/auth/callback", "/client/login", "/admin/login",
];
const privatePrefixes = [
  "/admin", "/client/", "/booking/", "/bookings", "/login", "/signup",
  "/forgot-password", "/avatar", "/theme", "/luxury/theme", "/more", "/auth/callback", "/api/",
];

// ── Write ──────────────────────────────────────────────────────────────────
// Verified Organization identity (mirrors src/config/business.ts)
const organization = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'PlayTurf',
  url: ORIGIN + '/',
  logo: ORIGIN + '/playturf-logo.webp',
  description: 'PlayTurf lets players find and book sports turfs — football grounds, cricket pitches, futsal and box-cricket courts — with live slot availability.',
  knowsAbout: ['Online Turf Booking', 'Sports Turf Booking', 'Cricket Turf Booking', 'Football Turf Booking', 'Sports Facility Discovery'],
  sameAs: ['https://twitter.com/playturfapp', 'https://instagram.com/playturfapp'],
};

const out = {
  generatedAt: new Date().toISOString(),
  origin: ORIGIN,
  organization,
  routes,
  knownSpaPaths,
  privatePrefixes,
};
if (!fs.existsSync(apiDir)) fs.mkdirSync(apiDir, { recursive: true });
fs.writeFileSync(path.join(apiDir, "agent-content.json"), JSON.stringify(out, null, 1));

// Amendment 2/4/5: runtime config snapshot for api/serve.js (CommonJS cannot
// import the ESM shared modules) — origin, flags and limits, same source.
fs.writeFileSync(path.join(apiDir, "seo-config.json"), JSON.stringify(buildRuntimeSeoConfig(env), null, 1));

// Sanity: the function requires this map to be parseable
JSON.parse(fs.readFileSync(path.join(apiDir, "agent-content.json"), "utf8"));
console.log(`✓ agent-content.json — ${Object.keys(routes).length} content routes (${turfs.length} venues), ${knownSpaPaths.length} SPA paths`);

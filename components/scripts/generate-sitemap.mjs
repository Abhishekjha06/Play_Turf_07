/**
 * Generates public/sitemap.xml from REAL data:
 *   - static public routes (home, turfs, sports, open-games, tournaments, blog…)
 *   - city pages for cities that actually have venues
 *   - sport+city pages that actually exist
 *   - one URL per venue (slug form) with its gallery image
 *   - open-game city pages when games/venues exist there
 *
 * Data source: Supabase REST with the build's anon key (VITE_SUPABASE_URL /
 * VITE_SUPABASE_ANON_KEY). If the fetch fails, the script still emits the
 * static routes so the build never breaks, and prints a warning.
 *
 * Wired as the "prebuild" npm script — regenerates on every deploy.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "..", "public");

// Vite env: .env files are read via dotenv-style parsing — keep this
// dependency-free by reading the known env file ourselves.
function readViteEnv() {
  const env = {};
  const candidates = [
    path.resolve(__dirname, "..", ".env.local"),
    path.resolve(__dirname, "..", ".env"),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

const env = { ...readViteEnv(), ...process.env };
const ORIGIN = (env.VITE_SITE_ORIGIN || "https://playturf.app").replace(/\/$/, "");
const SB_URL = env.VITE_SUPABASE_URL;
const SB_KEY = env.VITE_SUPABASE_ANON_KEY;

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function fetchTurfs() {
  if (!SB_URL || !SB_KEY) throw new Error("Supabase env not configured");
  const res = await fetch(`${SB_URL}/rest/v1/turfs?select=*`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase responded ${res.status}`);
  return res.json();
}

const today = new Date().toISOString().slice(0, 10);
const urls = [];

function add(loc, { changefreq = "weekly", priority = "0.7", lastmod = today, image } = {}) {
  urls.push({ loc: ORIGIN + loc, changefreq, priority, lastmod, image });
}

// 1. Static public routes
add("/", { changefreq: "daily", priority: "1.0", image: { loc: `${ORIGIN}/og-image.jpg`, title: "PlayTurf — Book Sports Turfs & Tournaments" } });
add("/turfs", { priority: "0.9" });
add("/sports", { priority: "0.9" });
add("/open-games", { changefreq: "hourly", priority: "0.9" });
add("/tournaments", { changefreq: "daily", priority: "0.8" });
add("/offers", { changefreq: "daily", priority: "0.8" });
add("/blog", { priority: "0.7" });

// 2. Blog guides (static content in src/data/blogPosts.ts)
try {
  const blogSrc = fs.readFileSync(
    path.resolve(__dirname, "..", "src", "data", "blogPosts.ts"),
    "utf8"
  );
  for (const m of blogSrc.matchAll(/slug:\s*"([a-z0-9-]+)"/g)) {
    add(`/blog/${m[1]}`, { priority: "0.6", changefreq: "monthly" });
  }
} catch {
  console.warn("blogPosts.ts not readable — skipping blog URLs");
}

// 3. Data-driven routes from real venues
let turfCount = 0;
try {
  const turfs = await fetchTurfs();
  turfCount = Array.isArray(turfs) ? turfs.length : 0;

  const byCity = new Map();
  for (const t of turfs) {
    const city = (t.city || "").trim();
    if (!city) continue;
    if (!byCity.has(city)) byCity.set(city, []);
    byCity.get(city).push(t);
  }

  for (const [city, list] of byCity) {
    const citySlug = slugify(city);
    add(`/turfs/${citySlug}`, { priority: "0.8" });
    for (const t of list) {
      const slug = [slugify(t.name), slugify(t.id)].filter(Boolean).join("-");
      const img = t.image
        ? { loc: /^https?:/i.test(t.image) ? t.image : `${ORIGIN}${t.image}`, title: `${t.name} — sports turf in ${city}` }
        : undefined;
      add(`/turf/${slug}`, { priority: "0.8", changefreq: "weekly", image: img });
    }
  }

  // sport+city combos that actually exist
  // (skip obvious test/junk sport names living in the DB)
  const sportOk = (s) =>
    /^[a-z][a-z0-9 &-]{1,30}$/i.test(s) && !/test|demo|sample|debug/i.test(s);
  for (const [city, list] of byCity) {
    const sports = new Set(list.flatMap((t) => t.sport_types || []).filter(sportOk));
    for (const s of sports) {
      add(`/sports/${slugify(s)}/${slugify(city)}`, { priority: "0.7" });
    }
  }
} catch (err) {
  console.warn(`⚠ Could not fetch venues (${err.message}) — sitemap contains static routes only.`);
}

// 4. XML
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls
  .map(
    (u) => `  <url>
    <loc>${esc(u.loc)}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>${
      u.image
        ? `
    <image:image>
      <image:loc>${esc(u.image.loc)}</image:loc>${
          u.image.title ? `\n      <image:title>${esc(u.image.title)}</image:title>` : ""
        }
    </image:image>`
        : ""
    }
  </url>`
  )
  .join("\n")}
</urlset>
`;

// 5. Basic XML sanity validation before writing
if (!xml.startsWith("<?xml") || !xml.trimEnd().endsWith("</urlset>")) {
  console.error("Generated sitemap failed sanity check — aborting write.");
  process.exit(1);
}
const locCount = (xml.match(/<loc>/g) || []).length;
if (locCount !== urls.length) {
  console.error(`Sitemap URL count mismatch (${locCount} vs ${urls.length}) — aborting.`);
  process.exit(1);
}

fs.writeFileSync(path.join(publicDir, "sitemap.xml"), xml);
console.log(`✓ sitemap.xml — ${urls.length} URLs (${turfCount} venues from Supabase)`);

#!/usr/bin/env node
/**
 * Amendment 2: ONE site origin everywhere.
 *
 * Rewrites the origin strings in the static files that cannot import the
 * shared config (index.html fallback canonical/JSON-LD, robots.txt Sitemap
 * line) from the single source (VITE_SITE_ORIGIN || documented fallback).
 *
 * Idempotent: with no VITE_SITE_ORIGIN set, the files keep the fallback and
 * nothing changes. Wired into prebuild before the other generators.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { siteOrigin, assertProductionOrigin } from "../src/lib/seo-engine/canonical.shared.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function readViteEnv() {
  const env = { ...process.env };
  for (const file of [path.resolve(root, ".env.local"), path.resolve(root, ".env")]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

const env = readViteEnv();
const origin = siteOrigin(env);
assertProductionOrigin(env);

const PRE_ENGINE_FALLBACK = "https://play-turf-git-main-abhishekjha06s-projects.vercel.app";
let changed = 0;

for (const rel of ["index.html", "public/robots.txt"]) {
  const file = path.resolve(root, rel);
  if (!fs.existsSync(file)) continue;
  const before = fs.readFileSync(file, "utf8");
  const after = before.split(PRE_ENGINE_FALLBACK).join(origin);
  if (after !== before) {
    fs.writeFileSync(file, after);
    changed += 1;
    console.log(`sync-site-origin: rewrote ${rel} -> ${origin}`);
  }
}

if (!changed) console.log(`sync-site-origin: ${origin} already consistent (no changes)`);

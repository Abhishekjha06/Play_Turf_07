#!/usr/bin/env node
/**
 * CI artifact hygiene check (owner round-3 item 4).
 *
 * Scans generated/committed SEO artifacts for hosts that must never appear:
 *   - example.com            → ALWAYS fails (placeholder leaked into output)
 *   - localhost              → ALWAYS fails (dev origin leaked into output)
 *   - *.vercel.app           → fails when STRICT_ARTIFACTS=1 (set once the
 *                              real production domain exists — mirrors the
 *                              prebuild origin guard, which keeps working on
 *                              vercel-hosted preview branches meanwhile)
 *
 * Exit 1 on any failure so CI blocks the merge/deploy.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");

const strict = process.env.STRICT_ARTIFACTS === "1";
const FILES = [
  "api/agent-content.json",
  "api/seo-config.json",
  "api/spa-index.html",
  "components/public/sitemap.xml",
  "components/public/robots.txt",
  "components/index.html",
];

const BANNED_ALWAYS = [/example\.com/i, /localhost(?!\.example)/i];
const BANNED_STRICT = [/[\w-]+\.vercel\.app/i];

let failures = 0;
for (const rel of FILES) {
  const file = resolve(root, rel);
  if (!existsSync(file)) continue; // artifacts are generated at build time
  const content = readFileSync(file, "utf8");
  for (const re of BANNED_ALWAYS) {
    if (re.test(content)) {
      failures += 1;
      console.error(`FAIL ${rel}: contains ${re}`);
    }
  }
  if (strict) {
    for (const re of BANNED_STRICT) {
      if (re.test(content)) {
        failures += 1;
        console.error(`FAIL ${rel}: contains a vercel.app origin (STRICT_ARTIFACTS=1)`);
      }
    }
  }
}

if (failures) {
  console.error(`artifact hygiene: ${failures} failure(s)`);
  process.exit(1);
}
console.log("artifact hygiene: clean");

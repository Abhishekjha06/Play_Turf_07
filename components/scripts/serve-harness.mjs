#!/usr/bin/env node
/**
 * Live-style harness for api/serve.js (owner review round 2, item 4):
 * drives the REAL handler (require + fake ServerResponse) and prints
 * { status, headers, body } as JSON. Used by tests and for manual checks.
 *
 * Usage: node scripts/serve-harness.mjs <path> [bot|browser|markdown]
 * Env: VERCEL_ENV, SEO_ENGINE_ENABLED, SUPABASE_URL, SUPABASE_ANON_KEY
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const apiDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../api");
const handler = require(resolve(apiDir, "serve.js"));

// Path via env WITHOUT the leading slash (HARNESS_PATH=turf/x) — Git Bash /
// MSYS mangles leading-slash values ("C:/Program Files/Git/sitemap.xml").
// Empty HARNESS_PATH = root. Default: the sitemap route.
const reqPath = "/" + (process.env.HARNESS_PATH || "sitemap.xml").replace(/^\/+/, "");
const mode = process.env.HARNESS_MODE || "browser";

const req = {
  url: reqPath,
  headers: {
    "user-agent":
      mode === "bot"
        ? "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
        : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) PlayTurfHarness",
    accept: mode === "markdown" ? "text/markdown" : "text/html",
  },
};

const result = { status: 0, headers: {}, body: "" };
const res = {
  statusCode: 0,
  headersYet: {},
  setHeader(k, v) {
    this.headersYet[k.toLowerCase()] = v;
  },
  get statusCodeOut() {
    return this.statusCode;
  },
  end(body) {
    result.status = this.statusCode;
    result.headers = this.headersYet;
    result.body = String(body ?? "");
  },
};

await handler(req, res);
if (!result.status) result.status = res.statusCode;
result.headers = res.headersYet;
console.log(JSON.stringify(result));

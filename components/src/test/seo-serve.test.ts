import { describe, it, expect, afterEach } from "vitest";
import { resolve } from "node:path";
import { createRequire } from "node:module";

/**
 * Owner round-2 item 4 — the edge must never 500 when Supabase env is
 * missing: /sitemap.xml falls back to the prebuild static routes, /turf/*
 * falls back to the build artifact. Drives the REAL handler (CommonJS
 * require, env controlled per test via require-cache invalidation).
 */

const requireCjs = createRequire(import.meta.url);
const servePath = resolve(process.cwd(), "../api/serve.js");

const BOT_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) PlayTurfTest";

const ENV_KEYS = [
  "SUPABASE_URL", "VITE_SUPABASE_URL",
  "SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY",
  "SEO_ENGINE_ENABLED", "SEO_SITEMAP_ENABLED", "SEO_REDIRECTS_ENABLED",
  "VERCEL_ENV",
];

type ServeResult = { status: number; headers: Record<string, string>; body: string };

/** Run the real serve.js handler with a controlled environment. */
async function serve(
  path: string,
  ua: string,
  envOverrides: Record<string, string | undefined> = {}
): Promise<ServeResult> {
  // serve.js reads env at module load — clear the require cache so every
  // call re-evaluates with the env we set here.
  delete (requireCjs.cache as Record<string, unknown>)[servePath];
  const saved: Record<string, string | undefined> = {};
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  Object.assign(process.env, envOverrides);
  try {
    const handler = requireCjs(servePath) as (
      req: { url: string; headers: Record<string, string> },
      res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (body?: string) => void }
    ) => Promise<void>;

    const headers: Record<string, string> = {};
    let statusCode = 0;
    let body = "";
    const res = {
      get statusCode() { return statusCode; },
      set statusCode(v: number) { statusCode = v; },
      setHeader: (k: string, v: string) => { headers[k.toLowerCase()] = v; },
      end: (b?: string) => { body = b || ""; },
    };
    const req = { url: path, headers: { "user-agent": ua, accept: "text/html" } };
    await handler(req, res);
    return { status: statusCode, headers, body };
  } finally {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    delete (requireCjs.cache as Record<string, unknown>)[servePath];
  }
}

describe("edge fallback: no 500s when Supabase env is missing (owner round-2 item 4)", () => {
  const NO_ENV = {
    SUPABASE_URL: undefined,
    VITE_SUPABASE_URL: undefined,
    SUPABASE_ANON_KEY: undefined,
    VITE_SUPABASE_ANON_KEY: undefined,
  };

  afterEach(() => {
    delete (requireCjs.cache as Record<string, unknown>)[servePath];
  });

  it("/sitemap.xml → 200 application/xml with the prebuild static routes (no 500)", async () => {
    const r = await serve("/sitemap.xml", BROWSER_UA, NO_ENV);
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toContain("application/xml");
    expect(r.body.startsWith("<?xml")).toBe(true);
    expect(r.body).toContain("/turfs/"); // static pages from the prebuild
    expect(r.body).not.toContain("Internal Server Error");
  });

  it("/turf/:slug (bot UA) → 200 bot HTML from the build artifact, no 500", async () => {
    const r = await serve("/turf/greenfield-arena-turf-1", BOT_UA, NO_ENV);
    expect(r.status).toBe(200);
    expect(r.body).toContain("<title>");
    expect(r.body).toContain("<h1>");
  });

  it("/turf/:slug (browser UA) → 200 SPA shell, no 500", async () => {
    const r = await serve("/turf/greenfield-arena-turf-1", BROWSER_UA, NO_ENV);
    expect(r.status).toBe(200);
    expect(r.body).toContain("<!doctype html>");
  });

  it("unknown path still returns a real 404 (no soft 200, no 500)", async () => {
    const r = await serve("/definitely/not/here", BROWSER_UA, NO_ENV);
    expect(r.status).toBe(404);
    expect(r.headers["x-robots-tag"]).toContain("noindex");
  });

  it("private paths stay noindex even without env", async () => {
    const r = await serve("/admin", BROWSER_UA, NO_ENV);
    expect(r.status).toBe(200);
    expect(r.headers["x-robots-tag"]).toContain("noindex");
  });
});

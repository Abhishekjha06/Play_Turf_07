import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { chromium, type Browser } from "playwright-core";

// ESM-safe paths + CommonJS require for serve.js, which lives outside the
// Vite root — mirrors scripts/serve-harness.mjs. Vitest cwd = components/.
const repoApiDir = resolve(process.cwd(), "../api");
const requireCjs = createRequire(import.meta.url);

/**
 * Owner round-2 item 6 — REAL DOM-level parity: render a turf page in
 * headless Chrome (the actual SPA) and diff title / H1 / canonical /
 * description / links / JSON-LD against the bot HTML that serve.js serves
 * for the same route (built from the same agent-content artifact).
 *
 * Integration test: requires the dev server on PARITY_BASE_URL
 * (default http://localhost:3030). Skips cleanly when it is down so CI unit
 * runs are unaffected.
 */

const BASE_URL = process.env.PARITY_BASE_URL || "http://localhost:3030/";
const ROUTE = "/turf/greenfield-arena-turf-1";

const artifact = JSON.parse(
  readFileSync(resolve(repoApiDir, "agent-content.json"), "utf8")
);
const ORIGIN: string = artifact.origin;

let browser: Browser | null = null;
let serverUp = false;

beforeAll(async () => {
  try {
    // NOTE: no AbortSignal — jsdom's fetch rejects Node-built signals.
    const probe = await fetch(new URL("/robots.txt", BASE_URL));
    serverUp = probe.ok;
  } catch (e) {
    console.warn("[parity] server probe failed:", String(e).slice(0, 160));
    serverUp = false;
  }
  if (!serverUp) return;
  const exe = process.env.PARITY_CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
  try {
    browser = await chromium.launch({ executablePath: exe, headless: true });
  } catch (e) {
    console.warn("[parity] chrome launch failed:", String(e).slice(0, 160));
  }
}, 30000);

afterAll(async () => {
  await browser?.close();
});

describe("Playwright DOM parity: SPA render vs bot HTML", () => {
  let spa: { title: string; h1: string; canonical: string; description: string; jsonldTypes: string[]; links: Set<string> };
  let bot: { title: string; h1: string; canonical: string; description: string; jsonldTypes: string[]; links: Set<string> };

  // Offline gate: tests below no-op with a warning when the dev server or
  // Chrome is unavailable (integration test — full assertions run locally /
  // against staging where PARITY_BASE_URL points).
  const ready = () => Boolean(serverUp && browser && spa && bot);

  beforeAll(async () => {
    if (!browser) return;

    // ── SPA side: real render ──
    const page = await browser.newPage();
    await page.goto(new URL(ROUTE, BASE_URL).toString(), { waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1", { timeout: 15000 });
    await page.waitForTimeout(1200); // let applySeo effects settle
    spa = await page.evaluate(() => ({
      title: document.title,
      h1: document.querySelector("h1")?.textContent?.trim() || "",
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") || "",
      description: document.querySelector('meta[name="description"]')?.getAttribute("content") || "",
      jsonldTypes: Array.from(document.querySelectorAll('script[type="application/ld+json"]')).flatMap((s) => {
        try {
          const obj = JSON.parse(s.textContent || "");
          const arr = Array.isArray(obj) ? obj : [obj];
          return arr.map((o: { "@type"?: string }) => String(o["@type"] || ""));
        } catch {
          return [];
        }
      }),
      links: new Set(
        Array.from(document.querySelectorAll("a[href]"))
          .map((a) => (a as HTMLAnchorElement).href)
          .filter((h) => !h.startsWith("mailto:") && !h.startsWith("tel:"))
      ),
    }));
    await page.close();

    // ── Bot side: the exact HTML serve.js serves to crawler UAs ──
    const handler = requireCjs(resolve(repoApiDir, "serve.js")) as unknown as {
      __internals: { toHtml: (route: unknown, path: string, opts?: object) => string };
    };
    const route = artifact.routes[ROUTE];
    if (!route) throw new Error(`artifact has no route for ${ROUTE} — regenerate agent-content.json`);
    const html = handler.__internals.toHtml(route, ROUTE, { status: 200 });

    const doc = new DOMParser().parseFromString(html, "text/html");
    const collect = (root: Document) => ({
      title: root.querySelector("title")?.textContent?.trim() || "",
      h1: root.querySelector("h1")?.textContent?.trim() || "",
      canonical: root.querySelector('link[rel="canonical"]')?.getAttribute("href") || "",
      description: root.querySelector('meta[name="description"]')?.getAttribute("content") || "",
      jsonldTypes: Array.from(root.querySelectorAll('script[type="application/ld+json"]')).flatMap((s) => {
        try {
          const obj = JSON.parse(s.textContent || "");
          const arr = Array.isArray(obj) ? obj : [obj];
          return arr.map((o: { "@type"?: string }) => String(o["@type"] || ""));
        } catch {
          return [];
        }
      }),
      links: new Set(
        Array.from(root.querySelectorAll("a[href]")).map((a) => {
          const href = a.getAttribute("href") || "";
          return href.startsWith("http") ? href : new URL(href, ORIGIN).toString().replace(/\/$/, href === "/" ? "/" : "");
        })
      ),
    });
    bot = collect(doc);
  }, 60000);

  it("title is identical between SPA and bot HTML", () => {
    if (!ready()) { console.warn("[parity] skipped — dev server/Chrome unavailable"); return; }
    expect(spa.title).toBe(bot.title);
  });

  it("H1 is identical between SPA and bot HTML", () => {
    if (!ready()) { console.warn("[parity] skipped — dev server/Chrome unavailable"); return; }
    expect(spa.h1).toBe(bot.h1);
  });

  it("canonical is identical (absolute, trailing-slash policy)", () => {
    if (!ready()) { console.warn("[parity] skipped — dev server/Chrome unavailable"); return; }
    expect(spa.canonical).toBe(bot.canonical);
    expect(spa.canonical.startsWith("https://")).toBe(true);
    expect(spa.canonical.endsWith("/")).toBe(true);
  });

  it("meta description is identical", () => {
    if (!ready()) { console.warn("[parity] skipped — dev server/Chrome unavailable"); return; }
    expect(spa.description).toBe(bot.description);
  });

  it("JSON-LD: both sides emit the turf entity (SportsActivityLocation) + breadcrumbs", () => {
    if (!ready()) { console.warn("[parity] skipped — dev server/Chrome unavailable"); return; }
    expect(spa.jsonldTypes).toContain("SportsActivityLocation");
    expect(bot.jsonldTypes).toContain("SportsActivityLocation");
    expect(spa.jsonldTypes).toContain("BreadcrumbList");
    expect(bot.jsonldTypes).toContain("BreadcrumbList");
  });

  it("every bot link resolves to a link the SPA also renders (no orphan bot links)", () => {
    if (!ready()) { console.warn("[parity] skipped — dev server/Chrome unavailable"); return; }
    // Compare PATHNAMES: the SPA runs on the dev origin (localhost) while the
    // bot HTML uses the canonical production origin — origin mismatch is
    // expected; the LINK TARGETS must match.
    const toPath = (u: string) => {
      try {
        return new URL(u, ORIGIN).pathname;
      } catch {
        return u;
      }
    };
    const spaPaths = new Set(Array.from(spa.links).map(toPath));
    // Nav-aid links the bot HTML adds (Homepage, Sitemap-style fallbacks) may
    // not be rendered as anchors by the SPA — they must still resolve to a
    // REAL route (artifact-known content route or SPA-rendered), never 404.
    const knownRoutes = new Set(Object.keys(artifact.routes));
    for (const href of bot.links) {
      const p = toPath(href);
      const ok = spaPaths.has(p) || knownRoutes.has(p) || artifact.knownSpaPaths.includes(p);
      expect(ok, `bot link ${href} (${p}) resolves to nothing`).toBe(true);
    }
  });
});

// Minimal DOMParser shim for the bot-side parse inside Node/vitest (happy-dom
// provides one; this guard documents the dependency).
declare const DOMParser: {
  new (): { parseFromString(html: string, type: string): Document & { querySelectorAll: (s: string) => Element[] } };
};

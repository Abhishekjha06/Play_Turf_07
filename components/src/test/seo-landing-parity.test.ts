import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { chromium, type Browser } from "playwright-core";

/**
 * Owner round-3 item 5b — for the NINE existing landing routes, the bot HTML
 * and the SPA must agree on title, H1, canonical and robots (both indexable).
 * Bot HTML comes from the agent-content artifact (build-time, live-DB sourced);
 * the SPA is rendered in headless Chrome against the dev server.
 */

const BASE_URL = process.env.PARITY_BASE_URL || "http://localhost:3030/";
const requireCjs = createRequire(import.meta.url);
const artifact = JSON.parse(readFileSync(resolve(process.cwd(), "../api/agent-content.json"), "utf8"));
const ORIGIN: string = artifact.origin;
const servePath = resolve(process.cwd(), "../api/serve.js");

// The nine existing landing routes (TurfsIndex, TurfsCity ×3, SportsIndex,
// SportCity ×4 — from the Phase 2/3 artifact reconciliation).
const LANDING_ROUTES = [
  "/turfs",
  "/turfs/delhi",
  "/turfs/bangalore",
  "/turfs/mumbai",
  "/sports",
  "/sports/futsal/delhi",
  "/sports/football/delhi",
  "/sports/football/bangalore",
  "/sports/futsal/bangalore",
];

let browser: Browser | null = null;

beforeAll(async () => {
  const exe = process.env.PARITY_CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
  browser = await chromium.launch({ executablePath: exe, headless: true });
}, 30000);

afterAll(async () => {
  await browser?.close();
});

function botHtml(routePath: string): string {
  delete (requireCjs.cache as Record<string, unknown>)[servePath];
  const handler = requireCjs(servePath) as unknown as {
    __internals: { toHtml: (route: unknown, path: string, opts?: object) => string };
  };
  const route = artifact.routes[routePath];
  if (!route) throw new Error(`artifact missing route ${routePath}`);
  return handler.__internals.toHtml(route, routePath, { status: 200 });
}

/** Regex extraction reads raw HTML — decode the entities serve.js escapes. */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

describe("landing routes: bot HTML vs SPA (round-3 item 5b)", () => {
  it.each(LANDING_ROUTES)("route %s: title, H1, canonical, robots agree between bot HTML and SPA", async (routePath) => {
    const html = botHtml(routePath);
    const botTitle = decodeEntities(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "");
    const botH1 = decodeEntities(html.match(/<h1>([^<]*)<\/h1>/)?.[1] ?? "");
    const botCanonical = decodeEntities(html.match(/rel="canonical" href="([^"]*)"/)?.[1] ?? "");
    const botRobots = decodeEntities(html.match(/<meta name="robots" content="([^"]*)"/)?.[1] ?? "");

    const page = await browser!.newPage();
    await page.goto(new URL(routePath, BASE_URL).toString(), { waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1", { timeout: 20000 });
    // Data-dependent pages get their real <title> only after the turfs fetch
    // resolves — wait for it to leave the index.html default.
    const DEFAULT_TITLE = "PlayTurf — Book Sports Turfs & Tournaments Near You";
    await page.waitForFunction((d) => document.title !== d, DEFAULT_TITLE, { timeout: 25000 });
    const spaTitle = await page.title();
    const spaH1 = await page.evaluate(() => document.querySelector("h1")?.textContent?.trim() || "");
    const spaCanonical = await page.evaluate(() => document.querySelector('link[rel="canonical"]')?.getAttribute("href") || "");
    const spaRobots = await page.evaluate(() => document.querySelector('meta[name="robots"]')?.getAttribute("content") || "");
    await page.close();

    // robots: both indexable (exact directive strings may differ in verbosity)
    expect(botRobots).not.toContain("noindex");
    expect(spaRobots).not.toContain("noindex");

    // title/H1/canonical: exact match
    expect(spaTitle, `title mismatch on ${routePath}`).toBe(botTitle);
    expect(spaH1, `h1 mismatch on ${routePath}`).toBe(botH1);
    expect(spaCanonical, `canonical mismatch on ${routePath}`).toBe(botCanonical);
  }, 45000);
});

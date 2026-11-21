import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { chromium, type Browser } from "playwright-core";

/**
 * Owner round-3 item 2 — Playwright smoke: home, a turf page, one landing
 * page and /sitemap.xml render without crashing.
 *
 * ⚠️ This suite FAILS (never skips) when the dev server or Chrome is
 * unavailable — that is the explicit requirement. Point PARITY_BASE_URL at a
 * running dev server before running it.
 */

const BASE_URL = process.env.PARITY_BASE_URL || "http://localhost:3030/";
const requireCjs = createRequire(import.meta.url);
const artifact = JSON.parse(readFileSync(resolve(process.cwd(), "../api/agent-content.json"), "utf8"));
const ORIGIN: string = artifact.origin;

let browser: Browser | null = null;

beforeAll(async () => {
  const exe = process.env.PARITY_CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
  browser = await chromium.launch({ executablePath: exe, headless: true });
}, 30000);

afterAll(async () => {
  await browser?.close();
});

// Data-dependent pages render their real <title> only after the turfs
// fetch resolves (~1-6s on a cold headless profile) — wait for the title to
// leave the index.html default instead of sleeping a fixed time.
const DEFAULT_TITLE = "PlayTurf — Book Sports Turfs & Tournaments Near You";
async function waitRealTitle(page: import("playwright-core").Page) {
  await page.waitForFunction((d) => document.title !== d, DEFAULT_TITLE, { timeout: 25000 });
}

describe("Playwright smoke: home, turf, landing, sitemap (fails if server/Chrome down)", () => {
  it("server is reachable (hard requirement — no skip)", async () => {
    const res = await fetch(new URL("/robots.txt", BASE_URL));
    expect(res.ok, `dev server at ${BASE_URL} is not reachable — start it and re-run`).toBe(true);
  });

  it("home renders its headline and no error boundary", { timeout: 30000 }, async () => {
    const page = await browser!.newPage();
    await page.goto(new URL("/", BASE_URL).toString(), { waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1", { timeout: 20000 });
    const text = await page.evaluate(() => document.body.innerText);
    expect(text).not.toContain("Something went wrong");
    expect(text.toLowerCase()).toContain("turfs");
    await page.close();
  });

  it("turf page renders name, price and no error boundary", async () => {
    const page = await browser!.newPage();
    await page.goto(new URL("/turf/greenfield-arena-turf-1", BASE_URL).toString(), { waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1", { timeout: 20000 });
    const text = await page.evaluate(() => document.body.innerText);
    expect(text).not.toContain("Could not load turf");
    expect(text).not.toContain("Something went wrong");
    expect(text).toMatch(/₹/);
    await page.close();
  });

  it("landing page /turfs/bangalore renders venues, no error boundary", async () => {
    const page = await browser!.newPage();
    await page.goto(new URL("/turfs/bangalore", BASE_URL).toString(), { waitUntil: "domcontentloaded" });
    await waitRealTitle(page);
    const text = await page.evaluate(() => document.body.innerText);
    expect(text).not.toContain("Something went wrong");
    expect(text).toMatch(/bangalore/i);
    await page.close();
  });

  it("/sitemap.xml returns 200 XML through the edge (or the prebuild static)", async () => {
    const res = await fetch(new URL("/sitemap.xml", BASE_URL).toString());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("xml");
    const body = await res.text();
    expect(body.startsWith("<?xml")).toBe(true);
  });

  it("bot HTML for a turf route carries title/H1/canonical (artifact-driven)", () => {
    const servePath = resolve(process.cwd(), "../api/serve.js");
    delete (requireCjs.cache as Record<string, unknown>)[servePath];
    const handler = requireCjs(servePath) as unknown as {
      __internals: { toHtml: (route: unknown, path: string, opts?: object) => string };
    };
    const route = artifact.routes["/turf/greenfield-arena-turf-1"];
    expect(route).toBeTruthy();
    const html = handler.__internals.toHtml(route, "/turf/greenfield-arena-turf-1", { status: 200 });
    expect(html).toContain("<title>");
    expect(html).toContain("<h1>");
    expect(html).toContain('rel="canonical"');
  });
});

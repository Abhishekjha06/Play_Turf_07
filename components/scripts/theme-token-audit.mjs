#!/usr/bin/env node
/**
 * Theme-token audit — verifies that every file converted to the unified
 * Premium Teal / AMOLED Black token system is free of hardcoded,
 * theme-specific colors. Runs against the documented exception allowlist
 * (print documents, image overlays/scrim furniture, brand artwork,
 * team colors, theme-preview swatches, black-alpha elevation shadows).
 *
 * Usage:  node scripts/theme-token-audit.mjs
 * Exit 0 = clean (only documented exceptions), exit 1 = undocumented violations.
 * Report: scripts/theme-token-audit-report.txt
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

/** Files converted to tokens in the unified-theme pass. */
const CONVERTED = [
  "luxury/LuxuryThemeProvider.tsx",
  "home/HeroCarousel.tsx",
  "home/SectionHeader.tsx",
  "home/CategoryPills.tsx",
  "home/LocationFilter.tsx",
  "home/TossModal.tsx",
  "offers/OfferCard.tsx",
  "layout/MobileShell.tsx",
  "layout/AppHeader.tsx",
  "open-games/OpenGameCard.tsx",
  "cricket/screens/PickMatch.tsx",
  "cricket/screens/ConfirmBet.tsx",
  "cricket/screens/SuccessScreen.tsx",
  "cricket/components/VsBadge.tsx",
  "pages/Home.tsx",
  "pages/Receipt.tsx",
  "pages/Admin.tsx",
  "pages/ClientBookingManagement.tsx",
  "booking/BookingTicket.tsx",
  "booking/JoinGameReceipt.tsx",
  "booking/HostBookingReceipt.tsx",
  "pages/client-dashboard/DashboardCalendar.tsx",
  "ui/CoolThemeToggle.tsx",
];

/** Checks: what we hunt for. */
const CHECKS = [
  { id: "hex", re: /#[0-9a-fA-F]{3,8}\b/g, label: "hardcoded hex color" },
  { id: "rgba", re: /\brgba?\([^)]*\)/g, label: "hardcoded rgb/rgba color" },
  { id: "tw-classes", re: /(?:bg|text|border|from|to|via)-(?:white|black|zinc|gray|neutral|stone|emerald|green|lime|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|red|orange|amber|yellow)(?:-\d+)?(?:\/\d+)?(?![\w-])/g, label: "hardcoded Tailwind palette class" },
  { id: "dark-variant", re: /\bdark:/g, label: "dark: variant (must use tokens instead)" },
  { id: "theme-branch", re: /themeId\s*===|isPremium|isPremiumTeal|dusky-white|midnight-gold/g, label: "conditional theme-specific JSX" },
];

/**
 * Documented exceptions. `allow` is applied per line: if ANY allow regex
 * matches the line, hits on that line are counted as documented.
 * Reasons are printed in the report so exceptions stay auditable.
 */
const FILE_ALLOWLIST = {
  // The provider IS the token source — its hex/HSL values are the definitions.
  "luxury/LuxuryThemeProvider.tsx": { reason: "theme token definitions (single source of truth)", allow: [/.*/] },
  // Each toggle position previews the OTHER theme's palette by design.
  "ui/CoolThemeToggle.tsx": { reason: "theme-preview swatches", allow: [/#/, /teal-|emerald-/] },
  // White text / dark scrims over banner photos are semantic constants.
  "home/HeroCarousel.tsx": { reason: "white text + scrim over banner photos", allow: [/text-white/, /border-white/, /bg-black/] },
  "offers/OfferCard.tsx": { reason: "white text over offer photo", allow: [/text-white/] },
  "open-games/OpenGameCard.tsx": { reason: "status badges + scrim over game photo; sportConfig = per-sport identity colors (basketball/cricket/default palettes)", allow: [/text-white/, /bg-black/, /bg-white/, /border-white/, /emerald-|rose-|orange-|amber-|zinc-|red-/, /#[0-9a-fA-F]/, /rgba?\(/] },
  // BookingTicket: white QR plate is a scanning constant; black-alpha shadow is elevation.
  "booking/BookingTicket.tsx": { reason: "QR white plate (scan reliability) + black-alpha elevation shadow", allow: [/#ffffff/, /rgba\(0,\s*0,\s*0/] },
  // Receipt: SVG team-emblem artwork (shield gradient/initials) + over-scrim modal furniture.
  "pages/Receipt.tsx": { reason: "SVG team-emblem artwork + black scrims/shadows", allow: [/rgba\(0,\s*0,\s*0/, /#000000/, /#FFFFFF/, /text-white/, /bg-black/] },
  "booking/JoinGameReceipt.tsx": { reason: "over-scrim modal furniture (white on black backdrop)", allow: [/bg-black/, /text-white/, /bg-white/] },
  "booking/HostBookingReceipt.tsx": { reason: "over-scrim modal furniture (white on black backdrop)", allow: [/bg-black/, /text-white/, /bg-white/] },
  // Admin: the X button sits on top of an image preview (over-image constant).
  "pages/Admin.tsx": { reason: "close button over image preview", allow: [/bg-black/] },
  // TossModal keeps its deliberate dark coin-panel look (brand artwork):
  // coin-side identity colors + white furniture on the dark panel.
  "home/TossModal.tsx": { reason: "coin-toss brand artwork (dark panel + coin-side identity colors)", allow: [/#/, /rgba?\(/, /text-white/, /bg-white/, /border-white/] },
  // Team colors and the shield SVG in PickMatch are team/brand artwork.
  "cricket/screens/PickMatch.tsx": { reason: "team-color artwork remnants via props only", allow: [/colors\[0\]/] },
  // The app header keeps its dark cinematic gradient in BOTH themes (token-driven
  // via --header-gradient), so its white logo/greeting/search furniture, the
  // white SVG wave artwork and black scrims are semantic constants.
  "layout/AppHeader.tsx": { reason: "white furniture + scrims on the always-dark themed header gradient", allow: [/text-white/, /rgba\(255,\s*255,\s*255/, /bg-black/, /rgba\(0,\s*0,\s*0/] },
  // White "VS"/team-name text sits on team emblem artwork (shield/coin visuals).
  "cricket/screens/PickMatch.tsx": { reason: "white text over team-emblem artwork", allow: [/text-white/] },
};

const linesOf = (text) => text.split(/\r?\n/);
const report = [];
let violations = 0;
let documented = 0;

for (const rel of CONVERTED) {
  const abs = join(SRC, rel);
  let text;
  try {
    text = readFileSync(abs, "utf8");
  } catch {
    report.push(`⚠ MISSING (deleted or renamed): ${rel}`);
    continue;
  }
  const allow = FILE_ALLOWLIST[rel];
  const fileHits = [];

  linesOf(text).forEach((line, i) => {
    for (const check of CHECKS) {
      // Token references are fine — only literal colors are violations.
      if (check.id === "rgba" && /var\(--/.test(line) && !check.re.test(line.replace(/var\([^)]*\)/g, ""))) continue;
      check.re.lastIndex = 0;
      let m;
      while ((m = check.re.exec(line)) !== null) {
        const allowed = allow && allow.allow.some((re) => re.test(line));
        if (allowed) {
          documented++;
          fileHits.push(`   · doc  L${i + 1} [${check.label}] ${m[0]}  — ${allow.reason}`);
        } else {
          violations++;
          fileHits.push(`   ✗ viol L${i + 1} [${check.label}] ${m[0]}`);
        }
      }
    }
  });

  if (fileHits.length) {
    report.push(`\n${rel}`);
    report.push(...fileHits);
  } else {
    report.push(`\n${rel}\n   ✓ clean`);
  }
}

const header = [
  "════════════════════════════════════════════════════════════",
  " THEME TOKEN AUDIT — unified Premium Teal / AMOLED Black",
  ` Date: ${new Date().toISOString()}`,
  ` Undocumented violations: ${violations}`,
  ` Documented exceptions:  ${documented}`,
  "════════════════════════════════════════════════════════════",
].join("\n");

const out = `${header}\n${report.join("\n")}\n`;
console.log(out);
writeFileSync(join(dirname(fileURLToPath(import.meta.url)), "theme-token-audit-report.txt"), out);
process.exitCode = violations > 0 ? 1 : 0;

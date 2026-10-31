#!/usr/bin/env node
/**
 * Play Turf mascot avatar generator.
 *
 * Builds the five fluffy plush mascots (Yeti, Sky, Blush, Mint, Buddy) from a
 * single shared SVG template — identical geometry/proportions/camera, only the
 * palette and per-character pose change (Mint waves, Buddy has happy closed
 * eyes + hearts) — then rasterizes them to transparent 512px WebP assets.
 *
 * Output:
 *   assets/avatars/svg/{id}.svg          (editable sources)
 *   assets/avatars/{yetiky|skylyt|blushsy|mintly|budly}.webp  (app assets)
 *   scripts/preview/{id}.png             (inspection only — safe to delete)
 *
 * Usage: node scripts/generate_avatars.mjs
 */
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(SCRIPT_DIR, "..", "..", "assets", "avatars");
const PREVIEW = join(SCRIPT_DIR, "preview");
mkdirSync(join(ASSETS, "svg"), { recursive: true });
mkdirSync(ASSETS, { recursive: true });
mkdirSync(PREVIEW, { recursive: true });

/* ── Palettes (body base / shade / light belly / cheek) ──────────────────── */
const PALETTES = {
  yeti:  { base: "#F4F1EA", shade: "#D6D1C6", light: "#FBFAF6", belly: "#FAF8F3", cheek: "#E8B8B0", file: "yetiky.webp" },
  sky:   { base: "#8FBBE8", shade: "#6B99C9", light: "#B9D6F1", belly: "#C6DEF4", cheek: "#E8A8B8", file: "skylyt.webp" },
  blush: { base: "#F2AFC0", shade: "#DB8FA5", light: "#F9D2DC", belly: "#FADCE4", cheek: "#E88A9E", file: "blushsy.webp" },
  mint:  { base: "#9FD8B4", shade: "#79BC93", light: "#C4E9D1", belly: "#D2EEDC", cheek: "#E8A8B0", file: "mintly.webp" },
  buddy: { base: "#F0DAB8", shade: "#D8BC92", light: "#F8ECD6", belly: "#FAF0DE", cheek: "#E8A088", file: "budly.webp" },
};

const EYE = "#2A2320"; // warm near-black, glossy
const SMILE = "#3A2E28";

/* ── Fur filters: turbulence displacement gives the plush, fluffy edge ───── */
const DEFS = (seed) => `
  <defs>
    <filter id="fur" x="-15%" y="-15%" width="130%" height="130%">
      <feTurbulence type="fractalNoise" baseFrequency="0.045 0.075" numOctaves="3" seed="${seed}" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="13" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="furSoft" x="-15%" y="-15%" width="130%" height="130%">
      <feTurbulence type="fractalNoise" baseFrequency="0.06 0.09" numOctaves="3" seed="${seed + 3}" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <radialGradient id="bodyGrad" cx="42%" cy="36%" r="75%">
      <stop offset="0%" stop-color="{light}"/>
      <stop offset="52%" stop-color="{base}"/>
      <stop offset="100%" stop-color="{shade}"/>
    </radialGradient>
    <linearGradient id="armGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{base}"/>
      <stop offset="100%" stop-color="{shade}"/>
    </linearGradient>
    <radialGradient id="bellyGrad" cx="50%" cy="42%" r="70%">
      <stop offset="0%" stop-color="{belly}"/>
      <stop offset="100%" stop-color="{belly}" stop-opacity="0.55"/>
    </radialGradient>
  </defs>`;

/* ── Shared geometry (identical for the whole mascot family) ─────────────── */
const BODY_PATH =
  "M 256 92 C 318 92 362 138 380 208 C 398 268 406 322 394 366 C 376 420 322 438 256 438 " +
  "C 190 438 136 420 118 366 C 106 322 114 268 132 208 C 150 138 194 92 256 92 Z";

function furTufts(shade) {
  // short, dense fuzz hugging the silhouette — soft plush edge, no stray spikes
  const strands = [
    [196, 104, -30], [220, 96, -18], [244, 92, -6], [268, 92, 6], [292, 97, 18], [316, 106, 30],
    [152, 142, -50], [360, 140, 48], [132, 196, -66], [380, 192, 64],
    [118, 258, -82], [394, 254, 80], [116, 314, -95], [396, 310, 92],
  ];
  return strands
    .map(
      ([x, y, r]) =>
        `<path d="M ${x} ${y} q 3 -8 9 -12" stroke="${shade}" stroke-width="5" stroke-linecap="round" fill="none" transform="rotate(${r} ${x} ${y})" opacity="0.5"/>`,
    )
    .join("\n      ");
}

function openEyes() {
  const eye = (cx) => `
      <ellipse cx="${cx}" cy="238" rx="10" ry="13.5" fill="${EYE}"/>
      <circle cx="${cx - 3.5}" cy="232.5" r="3.4" fill="#FFFFFF"/>
      <circle cx="${cx + 3}" cy="242" r="1.6" fill="#FFFFFF" opacity="0.7"/>`;
  return eye(214) + eye(298);
}

function closedEyes() {
  const arc = (cx) =>
    `<path d="M ${cx - 13} 240 Q ${cx} 226 ${cx + 13} 240" stroke="${EYE}" stroke-width="7" stroke-linecap="round" fill="none"/>`;
  return arc(214) + arc(298);
}

const smile = `
      <path d="M 235 278 Q 256 293 277 278" stroke="${SMILE}" stroke-width="7" stroke-linecap="round" fill="none"/>`;

const cheeks = (color, strong) => `
      <ellipse cx="182" cy="272" rx="17" ry="11" fill="${color}" opacity="${strong ? 0.55 : 0.35}"/>
      <ellipse cx="330" cy="272" rx="17" ry="11" fill="${color}" opacity="${strong ? 0.55 : 0.35}"/>`;

const hearts = `
      <g fill="#F26D85" opacity="0.92">
        <path d="M 398 118 C 398 110 408 106 414 112 C 420 106 430 110 430 118 C 430 127 414 136 414 136 C 414 136 398 127 398 118 Z" transform="rotate(12 414 122)"/>
        <path d="M 436 158 C 436 152 443 149 448 153 C 453 149 460 152 460 158 C 460 165 448 172 448 172 C 448 172 436 165 436 158 Z" transform="rotate(-10 448 162)" opacity="0.8"/>
      </g>`;

function mascotSvg(id, pose) {
  const p = PALETTES[id];
  const defs = DEFS(p.seed ?? 7).replaceAll("{light}", p.light).replaceAll("{base}", p.base).replaceAll("{shade}", p.shade).replaceAll("{belly}", p.belly);

  // Arms: default hang at the sides; Mint waves (right arm up); Buddy hugs (arms in, up front).
  // Drawn AFTER the body so the stubby arms stay visible.
  const arms =
    pose === "wave"
      ? `
      <ellipse cx="106" cy="318" rx="36" ry="58" transform="rotate(18 106 318)" fill="url(#armGrad)"/>
      <ellipse cx="398" cy="174" rx="34" ry="54" transform="rotate(-48 398 174)" fill="url(#armGrad)"/>`
      : pose === "hug"
        ? `
      <ellipse cx="172" cy="332" rx="38" ry="54" transform="rotate(26 172 332)" fill="url(#armGrad)"/>
      <ellipse cx="340" cy="332" rx="38" ry="54" transform="rotate(-26 340 332)" fill="url(#armGrad)"/>`
        : `
      <ellipse cx="102" cy="318" rx="36" ry="58" transform="rotate(18 102 318)" fill="url(#armGrad)"/>
      <ellipse cx="410" cy="318" rx="36" ry="58" transform="rotate(-18 410 318)" fill="url(#armGrad)"/>`;

  const face =
    pose === "sleepy"
      ? closedEyes() + smile + cheeks(p.cheek, id === "blush") + hearts
      : openEyes() + smile + cheeks(p.cheek, id === "blush");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  ${defs}
  <!-- furry silhouette group: body + limbs + feet -->
  <g filter="url(#fur)">
    <!-- feet -->
    <ellipse cx="207" cy="438" rx="47" ry="26" fill="${p.shade}"/>
    <ellipse cx="305" cy="438" rx="47" ry="26" fill="${p.shade}"/>
    <!-- body -->
    <path d="${BODY_PATH}" fill="url(#bodyGrad)"/>
    <!-- arms (on top of the body so the stubby arms stay visible) -->
    ${arms}
  </g>
  <!-- belly (smooth, no fur displacement) -->
  <ellipse cx="256" cy="348" rx="97" ry="84" fill="url(#bellyGrad)" filter="url(#furSoft)"/>
  <!-- fur strands on the head/sides -->
  <g filter="url(#furSoft)">
      ${furTufts(p.shade)}
  </g>
  <!-- face -->
  ${face}
</svg>`;
}

/* ── Build ───────────────────────────────────────────────────────────────── */
const POSES = { yeti: "stand", sky: "stand", blush: "stand", mint: "wave", buddy: "sleepy" };

for (const [id, pose] of Object.entries(POSES)) {
  const svg = mascotSvg(id, pose);
  const svgPath = join(ASSETS, "svg", `${id}.svg`);
  writeFileSync(svgPath, svg, "utf8");

  const p = PALETTES[id];
  const webpPath = join(ASSETS, p.file);
  const pngPreview = join(PREVIEW, `${id}.png`);

  await sharp(Buffer.from(svg), { density: 96 })
    .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90, alphaQuality: 90 })
    .toFile(webpPath);

  await sharp(Buffer.from(svg), { density: 96 })
    .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(pngPreview);

  console.log(`✓ ${id} → ${p.file}`);
}
console.log("Mascot assets generated.");

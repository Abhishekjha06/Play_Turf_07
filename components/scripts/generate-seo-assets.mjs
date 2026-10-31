/**
 * Generates the SEO/social image assets referenced by index.html:
 *   public/og-image.jpg          1200x630 social card
 *   public/apple-touch-icon.png  180x180
 *   public/favicon-32x32.png     32x32
 *   public/favicon-16x16.png     16x16
 *   public/favicon.ico           256px PNG-in-ICO (valid modern format)
 *   public/safari-pinned-tab.svg monogram mask icon
 *
 * Run once (outputs are committed):  node scripts/generate-seo-assets.mjs
 * Uses sharp (already a devDependency). No network access needed.
 */
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "..", "public");
const logoPath = path.join(publicDir, "playturf-logo.webp");

if (!fs.existsSync(logoPath)) {
  console.error(`Logo not found at ${logoPath}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// OG image: 1200x630 dark card with the logo and brand text
// ---------------------------------------------------------------------------
const W = 1200;
const H = 630;

const ogSvg = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#050b09"/>
      <stop offset="0.55" stop-color="#07211c"/>
      <stop offset="1" stop-color="#050505"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.42" r="0.55">
      <stop offset="0" stop-color="#14b8a6" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#14b8a6" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <text x="${W / 2}" y="${H - 208}" text-anchor="middle" fill="#f4fdfb"
        font-family="Segoe UI, Arial, sans-serif" font-size="96" font-weight="800"
        letter-spacing="2">PlayTurf</text>
  <text x="${W / 2}" y="${H - 138}" text-anchor="middle" fill="#8fd9cf"
        font-family="Segoe UI, Arial, sans-serif" font-size="38" font-weight="500"
        letter-spacing="6">BOOK SPORTS TURFS NEAR YOU</text>
  <text x="${W / 2}" y="${H - 66}" text-anchor="middle" fill="#5c8b84"
        font-family="Segoe UI, Arial, sans-serif" font-size="26" font-weight="400"
        letter-spacing="3">Football · Cricket · Futsal · Box Cricket — live slots, instant booking</text>
</svg>`;

const logo = sharp(logoPath).resize(220, 220, {
  fit: "contain",
  background: { r: 0, g: 0, b: 0, alpha: 0 },
});
const logoBuffer = await logo.png().toBuffer();

await sharp({
  create: { width: W, height: H, channels: 4, background: { r: 5, g: 5, b: 5, alpha: 1 } },
})
  .composite([
    { input: Buffer.from(ogSvg), left: 0, top: 0 },
    { input: logoBuffer, left: Math.round(W / 2 - 110), top: 92 },
  ])
  .jpeg({ quality: 90 })
  .toFile(path.join(publicDir, "og-image.jpg"));
console.log("✓ og-image.jpg (1200x630)");

// ---------------------------------------------------------------------------
// Favicons from the logo
// ---------------------------------------------------------------------------
const fit = { fit: "contain", background: { r: 5, g: 11, b: 9, alpha: 1 } };
await sharp(logoPath).resize(180, 180, fit).png().toFile(path.join(publicDir, "apple-touch-icon.png"));
await sharp(logoPath).resize(32, 32, fit).png().toFile(path.join(publicDir, "favicon-32x32.png"));
await sharp(logoPath).resize(16, 16, fit).png().toFile(path.join(publicDir, "favicon-16x16.png"));
console.log("✓ apple-touch-icon.png, favicon-32x32.png, favicon-16x16.png");

// ICO container with an embedded 256px PNG (Vista+ format, all modern browsers)
const icoSource = await sharp(logoPath).resize(256, 256, fit).png().toBuffer();
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // image count
const entry = Buffer.alloc(16);
entry.writeUInt8(0, 0); // width 256 -> 0
entry.writeUInt8(0, 1); // height 256 -> 0
entry.writeUInt8(0, 2); // palette
entry.writeUInt8(0, 3); // reserved
entry.writeUInt16LE(1, 4); // color planes
entry.writeUInt16LE(32, 6); // bits per pixel
entry.writeUInt32LE(icoSource.length, 8);
entry.writeUInt32LE(22, 12); // data offset (6 + 16)
fs.writeFileSync(path.join(publicDir, "favicon.ico"), Buffer.concat([header, entry, icoSource]));
console.log("✓ favicon.ico (256px PNG-in-ICO)");

// Safari pinned tab: simple monogram mask
fs.writeFileSync(
  path.join(publicDir, "safari-pinned-tab.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="#0f766e" d="M4 2h24a2 2 0 0 1 2 2v24a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm6 6v4h12v2H12a4 4 0 0 0-4 4v2a4 4 0 0 0 4 4h16v-4H12v-2h12a4 4 0 0 0 4-4v-2a4 4 0 0 0-4-4H10z"/></svg>\n`
);
console.log("✓ safari-pinned-tab.svg");

console.log("All SEO assets generated.");

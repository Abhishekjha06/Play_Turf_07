/**
 * Post-build: hand the SPA shell to the /api/serve function.
 *
 * dist/index.html must NOT be a static file — otherwise `/` is served
 * statically before rewrites run, and the homepage can never do content
 * negotiation or return real 404 decisions. We copy it into the function's
 * directory (includeFiles ships it with the function) and remove it from the
 * static output. Browsers still get the identical SPA: the function serves
 * this exact HTML.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distIndex = path.resolve(__dirname, "..", "dist", "index.html");
const apiTarget = path.resolve(__dirname, "..", "..", "api", "spa-index.html");

if (!fs.existsSync(distIndex)) {
  console.error("postbuild: dist/index.html not found — build output incomplete.");
  process.exit(1);
}

fs.copyFileSync(distIndex, apiTarget);
fs.rmSync(distIndex);

// Sanity: the copied shell must be complete (has the root + module script)
const html = fs.readFileSync(apiTarget, "utf8");
if (!html.includes('id="root"') || !html.includes('type="module"')) {
  console.error("postbuild: copied index.html failed sanity check.");
  process.exit(1);
}
console.log("✓ api/spa-index.html — SPA shell embedded into the serve function");

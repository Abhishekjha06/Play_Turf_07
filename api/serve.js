/**
 * Vercel serverless function — the SPA fallback with agent support.
 *
 * Replaces the blanket "rewrite everything to index.html" that produced soft
 * 404s. Behaviour:
 *
 *  1. Known route (from api/agent-content.json, generated at build time from
 *     real data):
 *       - Accept: text/markdown → Markdown representation (200), Vary: Accept
 *       - Search/AI crawler user-agent → full content HTML (readable WITHOUT
 *         JavaScript), same canonical URL, Vary: Accept
 *       - Ordinary browser → the built React SPA (index.html)
 *  2. Valid browser-only routes (login, dashboards, callbacks) → SPA for
 *     browsers, minimal noindex page for crawlers.
 *  3. Anything else → a REAL HTTP 404 (HTML or Markdown by Accept).
 *
 * Private prefixes always get X-Robots-Tag: noindex; public routes get
 * index, follow. Vary: Accept is set on every content-negotiated response so
 * CDN caches never mix representations.
 */

const content = require("./agent-content.json");

const ROUTES = content.routes || {};
const SPA_PATHS = new Set(content.knownSpaPaths || []);
const PRIVATE_PREFIXES = content.privatePrefixes || [];
const ORIGIN = content.origin || "https://playturf.app";

const BOT_UA =
  /(bot|crawler|spider|slurp|googlebot|bingbot|yandex|baiduspider|duckduckbot|facebookexternalhit|linkedinbot|twitterbot|whatsapp|telegrambot|gptbot|claudebot|anthropic-ai|perplexity|oai-httpclient|chatgpt|openai|applebot|semrush|ahrefs|mj12bot|petalbot|bytespider|amazonbot|diffbot|smartproxy|serp)/i;

/** Parse an Accept header into a q-weighted map. */
function parseAccept(header) {
  const weights = {};
  String(header || "")
    .split(",")
    .forEach((part) => {
      const [type, ...params] = part.trim().split(";");
      let q = 1;
      for (const p of params) {
        const m = p.trim().match(/^q=([\d.]+)$/);
        if (m) q = parseFloat(m[1]);
      }
      weights[type.trim().toLowerCase()] = Math.max(weights[type.trim().toLowerCase()] || 0, q);
    });
  return weights;
}

function prefersMarkdown(header) {
  const w = parseAccept(header);
  const md = w["text/markdown"] ?? w["text/x-markdown"] ?? 0;
  const html = w["text/html"] ?? (header && /text\/\*/.test(header) && !/text\/markdown/.test(header) ? 1 : 0);
  const any = w["*/*"] ?? 0;
  if (md === 0) return false;
  return md > html || (md > 0 && html === 0 && md >= any);
}

function normalizePath(pathname) {
  try {
    return decodeURIComponent(pathname || "/");
  } catch {
    return pathname || "/";
  }
  // note: trailing slashes are canonicalized by Vercel (trailingSlash: true)
}

function isPrivate(path_) {
  return PRIVATE_PREFIXES.some((p) => path_ === p || (p.endsWith("/") ? path_.startsWith(p) : path_.startsWith(p + "/") || path_ === p));
}

function toMarkdown(route, path_) {
  const lines = [];
  lines.push(`# ${route.h1 || route.title}`);
  lines.push("");
  if (route.description) lines.push(route.description, "");
  for (const s of route.sections || []) {
    lines.push(`## ${s.h2}`, "");
    if (Array.isArray(s.body)) {
      s.body.forEach((b) => lines.push(`- ${b}`));
      lines.push("");
    } else {
      lines.push(s.body, "");
    }
  }
  if (route.links && route.links.length) {
    lines.push("## Related pages", "");
    for (const [label, href] of route.links) {
      lines.push(`- [${label}](${ORIGIN}${href})`);
    }
    lines.push("");
  }
  lines.push("---", "");
  lines.push(`Sitemap: ${ORIGIN}/sitemap.xml`, `Agent documentation: ${ORIGIN}/llms.txt`);
  return lines.join("\n");
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toHtml(route, path_, { status = 200 } = {}) {
  const robots = route.robots === "noindex" || isPrivate(path_) ? "noindex, follow" : "index, follow, max-image-preview:large";
  const sections = (route.sections || [])
    .map((s) => {
      const body = Array.isArray(s.body)
        ? `<ul>${s.body.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`
        : `<p>${escapeHtml(s.body)}</p>`;
      return `<section><h2>${escapeHtml(s.h2)}</h2>${body}</section>`;
    })
    .join("\n");
  const links = (route.links || [])
    .map(([label, href]) => `<li><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></li>`)
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(route.title)}</title>
<meta name="description" content="${escapeHtml(route.description)}">
<meta name="robots" content="${robots}">
<link rel="canonical" href="${ORIGIN}${escapeHtml(path_)}">
<meta property="og:title" content="${escapeHtml(route.title)}">
<meta property="og:description" content="${escapeHtml(route.description)}">
<meta property="og:url" content="${ORIGIN}${escapeHtml(path_)}">
<meta property="og:site_name" content="PlayTurf">
<style>
  body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;margin:0;background:#070808;color:#e7eceb;line-height:1.6}
  main{max-width:760px;margin:0 auto;padding:2.5rem 1.25rem 4rem}
  a{color:#2dd4bf}
  h1{font-size:1.6rem;letter-spacing:-0.02em}
  h2{font-size:1.05rem;margin-top:2rem;color:#99f6e4}
  .brand{display:inline-flex;gap:.5rem;align-items:center;font-weight:800;text-decoration:none;margin-bottom:1.5rem}
  .brand span{background:rgba(20,184,166,.15);color:#2dd4bf;border:1px solid rgba(20,184,166,.3);border-radius:.6rem;padding:.3rem .55rem;font-size:.8rem}
  footer{border-top:1px solid rgba(255,255,255,.08);margin-top:3rem;padding-top:1rem;font-size:.8rem;color:#71717a}
  ul{padding-left:1.2rem}
</style>
</head>
<body>
<main>
<a class="brand" href="/"><span>PlayTurf</span></a>
<h1>${escapeHtml(route.h1 || route.title)}</h1>
${sections}
<nav><ul>${links}</ul></nav>
<footer>PlayTurf — online sports turf discovery and booking. <a href="/">Open the full app</a>.</footer>
</main>
</body>
</html>`;
}

function notFoundHtml(path_) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>404 – Page Not Found | PlayTurf</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${ORIGIN}/404">
<style>
  body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#070808;color:#e7eceb;line-height:1.6}
  .card{max-width:520px;padding:2.5rem;text-align:center}
  a{color:#2dd4bf}
  code{background:rgba(255,255,255,.07);border-radius:.4rem;padding:.15rem .4rem;font-size:.85em}
  ul{text-align:left;display:inline-block}
</style>
</head>
<body>
<div class="card">
<h1>404 – Page Not Found</h1>
<p>The requested PlayTurf page could not be found.</p>
<p>The resource may have been moved, removed or may never have existed.</p>
<p>You can explore PlayTurf using the <a href="/">homepage</a>, the pages below, the <a href="/sitemap.xml">sitemap</a> and the <a href="/llms.txt">agent documentation</a>.</p>
<ul>
<li><a href="/">Homepage</a></li>
<li><a href="/turfs">Turfs</a></li>
<li><a href="/open-games">Open Games</a></li>
<li><a href="/blog">Guides</a></li>
<li><a href="/about">About</a></li>
<li><a href="/contact">Contact</a></li>
<li><a href="/privacy">Privacy</a></li>
</ul>
<p><code>${escapeHtml(path_)}</code></p>
</div>
</body>
</html>`;
}

function notFoundMarkdown(path_) {
  return [
    "# 404 – Page Not Found",
    "",
    "The requested PlayTurf page could not be found.",
    "",
    "The resource may have been moved, removed or may never have existed.",
    "",
    `Requested URL: ${ORIGIN}${path_}`,
    "",
    "You can explore PlayTurf using the homepage, the public pages, the sitemap and the agent documentation.",
    "",
    `- Homepage: ${ORIGIN}/`,
    "- About: /about",
    "- Contact: /contact",
    "- Privacy: /privacy",
    `- Sitemap: ${ORIGIN}/sitemap.xml`,
    `- Agent documentation: ${ORIGIN}/llms.txt`,
    "",
  ].join("\n");
}

function privateMarkdown(path_) {
  return [
    "# PlayTurf — Private page",
    "",
    `The URL ${ORIGIN}${path_} is part of the PlayTurf application but is not public content.`,
    "",
    "It requires an authenticated account and is excluded from search indexing by design.",
    "",
    "Public content is available from the homepage and the sitemap.",
    "",
    `- Homepage: ${ORIGIN}/`,
    `- Sitemap: ${ORIGIN}/sitemap.xml`,
    `- Agent documentation: ${ORIGIN}/llms.txt`,
    "",
  ].join("\n");
}

async function getIndexHtml(req) {
  // The built SPA — served unchanged so the browser experience is identical.
  const target = new URL("/index.html", `https://${req.headers.host || "playturf.app"}`);
  const res = await fetch(target, { headers: { "user-agent": "playturf-serve-fn" } });
  if (!res.ok) throw new Error(`index.html fetch failed: ${res.status}`);
  return res.text();
}

module.exports = async (req, res) => {
  const path_ = normalizePath((req.url || "/").split("?")[0].replace(/\/+$/, "") || "/");
  const ua = req.headers["user-agent"] || "";
  const accept = req.headers.accept || "";
  const wantsMarkdown = prefersMarkdown(accept);
  const varyHeaders = { Vary: "Accept", "X-Content-Type-Options": "nosniff" };

  const sendHtml = (status, body, robotsTag) => {
    res.status(status).set({
      ...varyHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": robotsTag,
    }).send(body);
  };
  const sendMarkdown = (status, body) => {
    res.status(status).set({
      ...varyHeaders,
      "Content-Type": "text/markdown; charset=utf-8",
    }).send(body);
  };

  // 1. Real content route
  const route = ROUTES[path_];
  if (route) {
    if (wantsMarkdown) return sendMarkdown(200, toMarkdown(route, path_));
    const robotsTag = isPrivate(path_) ? "noindex, follow" : "index, follow, max-image-preview:large";
    if (BOT_UA.test(ua)) return sendHtml(200, toHtml(route, path_), robotsTag);
    try {
      const html = await getIndexHtml(req);
      return sendHtml(200, html, robotsTag);
    } catch (err) {
      return sendHtml(200, toHtml(route, path_), robotsTag);
    }
  }

  // 2. Valid browser-only routes (private app pages)
  if (SPA_PATHS.has(path_) || isPrivate(path_)) {
    if (wantsMarkdown) return sendMarkdown(200, privateMarkdown(path_));
    const robotsTag = "noindex, follow";
    if (BOT_UA.test(ua)) {
      return sendHtml(200, toHtml(
        { title: "PlayTurf", description: "This PlayTurf page requires an authenticated account and is not indexed.", h1: "Private page", sections: [], links: [["Homepage", "/"]] },
        path_,
        { status: 200 }
      ), robotsTag);
    }
    try {
      const html = await getIndexHtml(req);
      return sendHtml(200, html, robotsTag);
    } catch (err) {
      return sendHtml(200, notFoundHtml(path_), robotsTag);
    }
  }

  // 3. Everything else — a real 404
  if (wantsMarkdown) return sendMarkdown(404, notFoundMarkdown(path_));
  return sendHtml(404, notFoundHtml(path_), "noindex");
};

module.exports.__internals = { prefersMarkdown, normalizePath, isPrivate, toMarkdown, toHtml, notFoundMarkdown };

// Shared SEO-engine logic lives in plain .mjs modules (imported by Node build
// scripts and api/serve.js — they cannot consume TS). App code reaches them
// through the typed wrappers in lib/seo-engine/index.ts.
declare module "*.mjs";

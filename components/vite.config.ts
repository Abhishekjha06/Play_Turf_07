import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import viteCompression from "vite-plugin-compression";
import { visualizer } from "rollup-plugin-visualizer";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 3030,
    hmr: {
      overlay: false,
    },
    fs: {
      allow: ['..'],
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // BUILD-2: gzip + brotli compression for static assets (build-only)
    mode === "production" && viteCompression({ algorithm: "gzip", threshold: 1024, outputDir: "." }),
    mode === "production" && viteCompression({ algorithm: "brotliCompress", threshold: 1024, outputDir: "." }),
    // BUILD-3: bundle visualizer (only in analyze mode)
    mode === "analyze" && visualizer({ open: true, filename: "bundle-stats.html", gzipSize: true }),
  ].filter(Boolean),
  build: {
    // BUILD-1: Terser minification with console/debugger removal in production
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: mode === "production",
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Core React — smallest, most stable, best cached
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) {
            return "vendor-react";
          }
          // Router
          if (id.includes("node_modules/react-router-dom/") || id.includes("node_modules/@remix-run/")) {
            return "vendor-router";
          }
          // Radix UI — large, very stable, rarely changes
          if (id.includes("node_modules/@radix-ui/")) {
            return "vendor-radix";
          }
          // Supabase — stable, isolated
          if (id.includes("node_modules/@supabase/")) {
            return "vendor-supabase";
          }
          // Framer Motion — animation, isolated
          if (id.includes("node_modules/framer-motion/")) {
            return "vendor-framer";
          }
          // TanStack Query — data fetching
          if (id.includes("node_modules/@tanstack/")) {
            return "vendor-query";
          }
          // Lucide icons — large icon set
          if (id.includes("node_modules/lucide-react/")) {
            return "vendor-icons";
          }
          // Remaining utilities
          if (id.includes("node_modules/")) {
            return "vendor-misc";
          }
        },
      },
    },
  },
  resolve: {
    alias: [
      { find: "@/assets", replacement: path.resolve(__dirname, "../assets") },
      { find: "@/components", replacement: path.resolve(__dirname, "./src/components") },
      { find: "@/ui", replacement: path.resolve(__dirname, "./src/ui") },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));

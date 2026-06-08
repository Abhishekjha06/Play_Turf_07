import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import viteCompression from "vite-plugin-compression";
import { visualizer } from "rollup-plugin-visualizer";
import { VitePWA } from "vite-plugin-pwa";

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
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Play Turf',
        short_name: 'PlayTurf',
        description: 'Book sports turfs and join tournaments easily',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    }),
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
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/scheduler/") ||
            id.includes("node_modules/object-assign/")
          ) {
            return "vendor-react";
          }
          // Router
          if (
            id.includes("node_modules/react-router/") ||
            id.includes("node_modules/react-router-dom/") ||
            id.includes("node_modules/@remix-run/")
          ) {
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

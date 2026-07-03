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
      allow: [".."],
    },
  },
  preview: {
    port: 4173,
    host: true,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),

    // BUILD-2: gzip + brotli compression for static assets (build-only)
    mode === "production" &&
      viteCompression({
        algorithm: "gzip",
        threshold: 1024,
        outputDir: ".",
        deleteOriginFile: false,
        filter: /\.(js|mjs|json|css|html|svg)$/,
      }),
    mode === "production" &&
      viteCompression({
        algorithm: "brotliCompress",
        threshold: 1024,
        outputDir: ".",
        deleteOriginFile: false,
        filter: /\.(js|mjs|json|css|html|svg)$/,
      }),

    // BUILD-3: bundle visualizer (only in analyze mode)
    mode === "analyze" &&
      visualizer({
        open: true,
        filename: "bundle-stats.html",
        gzipSize: true,
        brotliSize: true,
      }),

    // BUILD-4: Progressive Web App
    VitePWA({
      registerType: "autoUpdate",
      strategies: "generateSW",
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/, /^\/admin/, /^\/client\/login/],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 5, // 5 minutes
              },
              networkTimeoutSeconds: 10,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.storage\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "cdn-images-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        offlineFallback: {
          page: "/offline.html",
        },
      },
      manifest: {
        name: "PlayTurf",
        short_name: "PlayTurf",
        description: "Book sports turfs and join tournaments easily",
        theme_color: "#050505",
        background_color: "#050505",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        categories: ["sports", "booking", "lifestyle"],
        lang: "en",
        dir: "ltr",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "monochrome",
          },
        ],
        screenshots: [
          {
            src: "screenshot-narrow.png",
            sizes: "390x844",
            type: "image/png",
            form_factor: "narrow",
            label: "Home screen of PlayTurf",
          },
          {
            src: "screenshot-wide.png",
            sizes: "1280x720",
            type: "image/png",
            form_factor: "wide",
            label: "PlayTurf desktop view",
          },
        ],
        shortcuts: [
          {
            name: "Book a Turf",
            short_name: "Book",
            description: "Quickly book a sports turf",
            url: "/?action=book",
            icons: [{ src: "pwa-192x192.png", sizes: "192x192" }],
          },
          {
            name: "Open Games",
            short_name: "Games",
            description: "Join open games near you",
            url: "/open-games",
            icons: [{ src: "pwa-192x192.png", sizes: "192x192" }],
          },
          {
            name: "My Bookings",
            short_name: "Bookings",
            description: "View your upcoming bookings",
            url: "/bookings",
            icons: [{ src: "pwa-192x192.png", sizes: "192x192" }],
          },
        ],
        related_applications: [],
        prefer_related_applications: false,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ].filter(Boolean),

  build: {
    // BUILD-1: Terser minification with console/debugger removal in production
    minify: "terser",
    cssMinify: true,
    sourcemap: mode === "development",
    chunkSizeWarningLimit: 500,
    reportCompressedSize: false, // Faster builds
    assetsInlineLimit: 4096, // Inline small assets < 4KB
    cssCodeSplit: true,
    modulePreload: {
      polyfill: true,
    },
    target: ["es2022", "edge118", "firefox120", "chrome120", "safari17"],

    terserOptions: {
      compress: {
        drop_console: mode === "production",
        drop_debugger: true,
        passes: 2,
        pure_getters: true,
        unsafe_comps: true,
        unsafe_math: true,
        unsafe_methods: true,
      },
      mangle: {
        properties: {
          regex: /^_/,
        },
      },
      format: {
        comments: false,
        ecma: 2022,
      },
    },

    rollupOptions: {
      output: {
        // Optimized file naming for long-term caching
        entryFileNames: "assets/[name]-[hash:8].js",
        chunkFileNames: "assets/[name]-[hash:8].js",
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name || "";
          if (/\.(woff2?|ttf|otf|eot)$/.test(info)) {
            return "assets/fonts/[name]-[hash:8][extname]";
          }
          if (/\.(png|jpe?g|gif|svg|webp|avif|ico)$/.test(info)) {
            return "assets/images/[name]-[hash:8][extname]";
          }
          if (/\.css$/.test(info)) {
            return "assets/css/[name]-[hash:8][extname]";
          }
          return "assets/[name]-[hash:8][extname]";
        },
        // Manual chunks for optimal caching
        manualChunks(id) {
          // Core React — smallest, most stable, best cached
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/scheduler/") ||
            id.includes("node_modules/object-assign/") ||
            id.includes("node_modules/use-sync-external-store/")
          ) {
            return "vendor-react";
          }
          // Router
          if (
            id.includes("node_modules/react-router/") ||
            id.includes("node_modules/react-router-dom/") ||
            id.includes("node_modules/@remix-run/") ||
            id.includes("node_modules/history/")
          ) {
            return "vendor-router";
          }
          // Radix UI — large, very stable, rarely changes
          if (id.includes("node_modules/@radix-ui/")) {
            return "vendor-radix";
          }
          // Supabase — stable, isolated
          if (
            id.includes("node_modules/@supabase/") ||
            id.includes("node_modules/@supabase-realtime/")
          ) {
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
          // PDF rendering — very large, lazy-loaded
          if (
            id.includes("node_modules/@react-pdf/") ||
            id.includes("node_modules/pdfkit/") ||
            id.includes("node_modules/@react-pdf/") ||
            id.includes("node_modules/jspdf/") ||
            id.includes("node_modules/html2canvas/")
          ) {
            return "vendor-pdf";
          }
          // QR code generation
          if (
            id.includes("node_modules/qrcode/") ||
            id.includes("node_modules/dijkstrajs/")
          ) {
            return "vendor-qr";
          }
          // Recharts / charts
          if (
            id.includes("node_modules/recharts/") ||
            id.includes("node_modules/victory-") ||
            id.includes("node_modules/d3-")
          ) {
            return "vendor-charts";
          }
          // Date handling
          if (
            id.includes("node_modules/date-fns/") ||
            id.includes("node_modules/dayjs/")
          ) {
            return "vendor-date";
          }
          // Form handling
          if (
            id.includes("node_modules/react-hook-form/") ||
            id.includes("node_modules/@hookform/") ||
            id.includes("node_modules/zod/")
          ) {
            return "vendor-forms";
          }
          // Carousel / UI utilities
          if (
            id.includes("node_modules/embla-carousel/") ||
            id.includes("node_modules/vaul/") ||
            id.includes("node_modules/sonner/") ||
            id.includes("node_modules/cmdk/")
          ) {
            return "vendor-ui-utils";
          }
          // Sentry / monitoring
          if (
            id.includes("node_modules/@sentry/") ||
            id.includes("node_modules/web-vitals/")
          ) {
            return "vendor-monitoring";
          }
          // PostHog analytics
          if (id.includes("node_modules/posthog-js/")) {
            return "vendor-analytics";
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
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },

  // Optimize dependency pre-bundling
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@tanstack/react-query",
      "@supabase/supabase-js",
      "framer-motion",
      "lucide-react",
      "sonner",
      "zod",
      "date-fns",
      "clsx",
      "tailwind-merge",
      "class-variance-authority",
    ],
    exclude: ["@sentry/react"],
    force: true,
    esbuildOptions: {
      target: "es2022",
    },
  },

  // CSS optimizations
  css: {
    devSourcemap: mode === "development",
    modules: {
      scopeBehaviour: "local",
    },
  },
}));

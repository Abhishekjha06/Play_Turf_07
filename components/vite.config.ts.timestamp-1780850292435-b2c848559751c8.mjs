// vite.config.ts
import { defineConfig } from "file:///F:/Play_Turf_copy/components/node_modules/vite/dist/node/index.js";
import react from "file:///F:/Play_Turf_copy/components/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { componentTagger } from "file:///F:/Play_Turf_copy/components/node_modules/lovable-tagger/dist/index.js";
import viteCompression from "file:///F:/Play_Turf_copy/components/node_modules/vite-plugin-compression/dist/index.mjs";
import { visualizer } from "file:///F:/Play_Turf_copy/components/node_modules/rollup-plugin-visualizer/dist/plugin/index.js";
import { VitePWA } from "file:///F:/Play_Turf_copy/components/node_modules/vite-plugin-pwa/dist/index.js";
var __vite_injected_original_dirname = "F:\\Play_Turf_copy\\components";
var vite_config_default = defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 3030,
    hmr: {
      overlay: false
    },
    fs: {
      allow: [".."]
    }
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
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "masked-icon.svg"],
      manifest: {
        name: "Play Turf",
        short_name: "PlayTurf",
        description: "Book sports turfs and join tournaments easily",
        theme_color: "#000000",
        background_color: "#000000",
        display: "standalone",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      }
    })
  ].filter(Boolean),
  build: {
    // BUILD-1: Terser minification with console/debugger removal in production
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: mode === "production",
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) {
            return "vendor-react";
          }
          if (id.includes("node_modules/react-router-dom/") || id.includes("node_modules/@remix-run/")) {
            return "vendor-router";
          }
          if (id.includes("node_modules/@radix-ui/")) {
            return "vendor-radix";
          }
          if (id.includes("node_modules/@supabase/")) {
            return "vendor-supabase";
          }
          if (id.includes("node_modules/framer-motion/")) {
            return "vendor-framer";
          }
          if (id.includes("node_modules/@tanstack/")) {
            return "vendor-query";
          }
          if (id.includes("node_modules/lucide-react/")) {
            return "vendor-icons";
          }
          if (id.includes("node_modules/")) {
            return "vendor-misc";
          }
        }
      }
    }
  },
  resolve: {
    alias: [
      { find: "@/assets", replacement: path.resolve(__vite_injected_original_dirname, "../assets") },
      { find: "@/components", replacement: path.resolve(__vite_injected_original_dirname, "./src/components") },
      { find: "@/ui", replacement: path.resolve(__vite_injected_original_dirname, "./src/ui") },
      { find: "@", replacement: path.resolve(__vite_injected_original_dirname, "./src") }
    ],
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"]
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJGOlxcXFxQbGF5X1R1cmZfY29weVxcXFxjb21wb25lbnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJGOlxcXFxQbGF5X1R1cmZfY29weVxcXFxjb21wb25lbnRzXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9GOi9QbGF5X1R1cmZfY29weS9jb21wb25lbnRzL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djXCI7XG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuaW1wb3J0IHsgY29tcG9uZW50VGFnZ2VyIH0gZnJvbSBcImxvdmFibGUtdGFnZ2VyXCI7XG5pbXBvcnQgdml0ZUNvbXByZXNzaW9uIGZyb20gXCJ2aXRlLXBsdWdpbi1jb21wcmVzc2lvblwiO1xuaW1wb3J0IHsgdmlzdWFsaXplciB9IGZyb20gXCJyb2xsdXAtcGx1Z2luLXZpc3VhbGl6ZXJcIjtcbmltcG9ydCB7IFZpdGVQV0EgfSBmcm9tIFwidml0ZS1wbHVnaW4tcHdhXCI7XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiAoe1xuICBzZXJ2ZXI6IHtcbiAgICBob3N0OiBcIjo6XCIsXG4gICAgcG9ydDogMzAzMCxcbiAgICBobXI6IHtcbiAgICAgIG92ZXJsYXk6IGZhbHNlLFxuICAgIH0sXG4gICAgZnM6IHtcbiAgICAgIGFsbG93OiBbJy4uJ10sXG4gICAgfSxcbiAgfSxcbiAgcGx1Z2luczogW1xuICAgIHJlYWN0KCksXG4gICAgbW9kZSA9PT0gXCJkZXZlbG9wbWVudFwiICYmIGNvbXBvbmVudFRhZ2dlcigpLFxuICAgIC8vIEJVSUxELTI6IGd6aXAgKyBicm90bGkgY29tcHJlc3Npb24gZm9yIHN0YXRpYyBhc3NldHMgKGJ1aWxkLW9ubHkpXG4gICAgbW9kZSA9PT0gXCJwcm9kdWN0aW9uXCIgJiYgdml0ZUNvbXByZXNzaW9uKHsgYWxnb3JpdGhtOiBcImd6aXBcIiwgdGhyZXNob2xkOiAxMDI0LCBvdXRwdXREaXI6IFwiLlwiIH0pLFxuICAgIG1vZGUgPT09IFwicHJvZHVjdGlvblwiICYmIHZpdGVDb21wcmVzc2lvbih7IGFsZ29yaXRobTogXCJicm90bGlDb21wcmVzc1wiLCB0aHJlc2hvbGQ6IDEwMjQsIG91dHB1dERpcjogXCIuXCIgfSksXG4gICAgLy8gQlVJTEQtMzogYnVuZGxlIHZpc3VhbGl6ZXIgKG9ubHkgaW4gYW5hbHl6ZSBtb2RlKVxuICAgIG1vZGUgPT09IFwiYW5hbHl6ZVwiICYmIHZpc3VhbGl6ZXIoeyBvcGVuOiB0cnVlLCBmaWxlbmFtZTogXCJidW5kbGUtc3RhdHMuaHRtbFwiLCBnemlwU2l6ZTogdHJ1ZSB9KSxcbiAgICBWaXRlUFdBKHtcbiAgICAgIHJlZ2lzdGVyVHlwZTogJ2F1dG9VcGRhdGUnLFxuICAgICAgaW5jbHVkZUFzc2V0czogWydmYXZpY29uLmljbycsICdhcHBsZS10b3VjaC1pY29uLnBuZycsICdtYXNrZWQtaWNvbi5zdmcnXSxcbiAgICAgIG1hbmlmZXN0OiB7XG4gICAgICAgIG5hbWU6ICdQbGF5IFR1cmYnLFxuICAgICAgICBzaG9ydF9uYW1lOiAnUGxheVR1cmYnLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0Jvb2sgc3BvcnRzIHR1cmZzIGFuZCBqb2luIHRvdXJuYW1lbnRzIGVhc2lseScsXG4gICAgICAgIHRoZW1lX2NvbG9yOiAnIzAwMDAwMCcsXG4gICAgICAgIGJhY2tncm91bmRfY29sb3I6ICcjMDAwMDAwJyxcbiAgICAgICAgZGlzcGxheTogJ3N0YW5kYWxvbmUnLFxuICAgICAgICBpY29uczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHNyYzogJ3B3YS0xOTJ4MTkyLnBuZycsXG4gICAgICAgICAgICBzaXplczogJzE5MngxOTInLFxuICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZydcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHNyYzogJ3B3YS01MTJ4NTEyLnBuZycsXG4gICAgICAgICAgICBzaXplczogJzUxMng1MTInLFxuICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZycsXG4gICAgICAgICAgICBwdXJwb3NlOiAnYW55IG1hc2thYmxlJ1xuICAgICAgICAgIH1cbiAgICAgICAgXVxuICAgICAgfVxuICAgIH0pLFxuICBdLmZpbHRlcihCb29sZWFuKSxcbiAgYnVpbGQ6IHtcbiAgICAvLyBCVUlMRC0xOiBUZXJzZXIgbWluaWZpY2F0aW9uIHdpdGggY29uc29sZS9kZWJ1Z2dlciByZW1vdmFsIGluIHByb2R1Y3Rpb25cbiAgICBtaW5pZnk6IFwidGVyc2VyXCIsXG4gICAgdGVyc2VyT3B0aW9uczoge1xuICAgICAgY29tcHJlc3M6IHtcbiAgICAgICAgZHJvcF9jb25zb2xlOiBtb2RlID09PSBcInByb2R1Y3Rpb25cIixcbiAgICAgICAgZHJvcF9kZWJ1Z2dlcjogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgbWFudWFsQ2h1bmtzKGlkKSB7XG4gICAgICAgICAgLy8gQ29yZSBSZWFjdCBcdTIwMTQgc21hbGxlc3QsIG1vc3Qgc3RhYmxlLCBiZXN0IGNhY2hlZFxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9yZWFjdC9cIikgfHwgaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvcmVhY3QtZG9tL1wiKSkge1xuICAgICAgICAgICAgcmV0dXJuIFwidmVuZG9yLXJlYWN0XCI7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIFJvdXRlclxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9yZWFjdC1yb3V0ZXItZG9tL1wiKSB8fCBpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9AcmVtaXgtcnVuL1wiKSkge1xuICAgICAgICAgICAgcmV0dXJuIFwidmVuZG9yLXJvdXRlclwiO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBSYWRpeCBVSSBcdTIwMTQgbGFyZ2UsIHZlcnkgc3RhYmxlLCByYXJlbHkgY2hhbmdlc1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9AcmFkaXgtdWkvXCIpKSB7XG4gICAgICAgICAgICByZXR1cm4gXCJ2ZW5kb3ItcmFkaXhcIjtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gU3VwYWJhc2UgXHUyMDE0IHN0YWJsZSwgaXNvbGF0ZWRcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvQHN1cGFiYXNlL1wiKSkge1xuICAgICAgICAgICAgcmV0dXJuIFwidmVuZG9yLXN1cGFiYXNlXCI7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIEZyYW1lciBNb3Rpb24gXHUyMDE0IGFuaW1hdGlvbiwgaXNvbGF0ZWRcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvZnJhbWVyLW1vdGlvbi9cIikpIHtcbiAgICAgICAgICAgIHJldHVybiBcInZlbmRvci1mcmFtZXJcIjtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gVGFuU3RhY2sgUXVlcnkgXHUyMDE0IGRhdGEgZmV0Y2hpbmdcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvQHRhbnN0YWNrL1wiKSkge1xuICAgICAgICAgICAgcmV0dXJuIFwidmVuZG9yLXF1ZXJ5XCI7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIEx1Y2lkZSBpY29ucyBcdTIwMTQgbGFyZ2UgaWNvbiBzZXRcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvbHVjaWRlLXJlYWN0L1wiKSkge1xuICAgICAgICAgICAgcmV0dXJuIFwidmVuZG9yLWljb25zXCI7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIFJlbWFpbmluZyB1dGlsaXRpZXNcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvXCIpKSB7XG4gICAgICAgICAgICByZXR1cm4gXCJ2ZW5kb3ItbWlzY1wiO1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiBbXG4gICAgICB7IGZpbmQ6IFwiQC9hc3NldHNcIiwgcmVwbGFjZW1lbnQ6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi4vYXNzZXRzXCIpIH0sXG4gICAgICB7IGZpbmQ6IFwiQC9jb21wb25lbnRzXCIsIHJlcGxhY2VtZW50OiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjL2NvbXBvbmVudHNcIikgfSxcbiAgICAgIHsgZmluZDogXCJAL3VpXCIsIHJlcGxhY2VtZW50OiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjL3VpXCIpIH0sXG4gICAgICB7IGZpbmQ6IFwiQFwiLCByZXBsYWNlbWVudDogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSB9LFxuICAgIF0sXG4gICAgZGVkdXBlOiBbXCJyZWFjdFwiLCBcInJlYWN0LWRvbVwiLCBcInJlYWN0L2pzeC1ydW50aW1lXCIsIFwicmVhY3QvanN4LWRldi1ydW50aW1lXCIsIFwiQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5XCIsIFwiQHRhbnN0YWNrL3F1ZXJ5LWNvcmVcIl0sXG4gIH0sXG59KSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQTRRLFNBQVMsb0JBQW9CO0FBQ3pTLE9BQU8sV0FBVztBQUNsQixP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

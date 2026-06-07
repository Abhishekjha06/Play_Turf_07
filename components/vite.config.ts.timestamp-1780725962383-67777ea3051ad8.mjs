// vite.config.ts
import { defineConfig } from "file:///F:/Play_Turf_copy/components/node_modules/vite/dist/node/index.js";
import react from "file:///F:/Play_Turf_copy/components/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { componentTagger } from "file:///F:/Play_Turf_copy/components/node_modules/lovable-tagger/dist/index.js";
import viteCompression from "file:///F:/Play_Turf_copy/components/node_modules/vite-plugin-compression/dist/index.mjs";
import { visualizer } from "file:///F:/Play_Turf_copy/components/node_modules/rollup-plugin-visualizer/dist/plugin/index.js";
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
    mode === "analyze" && visualizer({ open: true, filename: "bundle-stats.html", gzipSize: true })
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
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/") || id.includes("node_modules/react-router-dom/")) {
            return "vendor-react";
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJGOlxcXFxQbGF5X1R1cmZfY29weVxcXFxjb21wb25lbnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJGOlxcXFxQbGF5X1R1cmZfY29weVxcXFxjb21wb25lbnRzXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9GOi9QbGF5X1R1cmZfY29weS9jb21wb25lbnRzL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djXCI7XG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuaW1wb3J0IHsgY29tcG9uZW50VGFnZ2VyIH0gZnJvbSBcImxvdmFibGUtdGFnZ2VyXCI7XG5pbXBvcnQgdml0ZUNvbXByZXNzaW9uIGZyb20gXCJ2aXRlLXBsdWdpbi1jb21wcmVzc2lvblwiO1xuaW1wb3J0IHsgdmlzdWFsaXplciB9IGZyb20gXCJyb2xsdXAtcGx1Z2luLXZpc3VhbGl6ZXJcIjtcblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+ICh7XG4gIHNlcnZlcjoge1xuICAgIGhvc3Q6IFwiOjpcIixcbiAgICBwb3J0OiAzMDMwLFxuICAgIGhtcjoge1xuICAgICAgb3ZlcmxheTogZmFsc2UsXG4gICAgfSxcbiAgICBmczoge1xuICAgICAgYWxsb3c6IFsnLi4nXSxcbiAgICB9LFxuICB9LFxuICBwbHVnaW5zOiBbXG4gICAgcmVhY3QoKSxcbiAgICBtb2RlID09PSBcImRldmVsb3BtZW50XCIgJiYgY29tcG9uZW50VGFnZ2VyKCksXG4gICAgLy8gQlVJTEQtMjogZ3ppcCArIGJyb3RsaSBjb21wcmVzc2lvbiBmb3Igc3RhdGljIGFzc2V0cyAoYnVpbGQtb25seSlcbiAgICBtb2RlID09PSBcInByb2R1Y3Rpb25cIiAmJiB2aXRlQ29tcHJlc3Npb24oeyBhbGdvcml0aG06IFwiZ3ppcFwiLCB0aHJlc2hvbGQ6IDEwMjQsIG91dHB1dERpcjogXCIuXCIgfSksXG4gICAgbW9kZSA9PT0gXCJwcm9kdWN0aW9uXCIgJiYgdml0ZUNvbXByZXNzaW9uKHsgYWxnb3JpdGhtOiBcImJyb3RsaUNvbXByZXNzXCIsIHRocmVzaG9sZDogMTAyNCwgb3V0cHV0RGlyOiBcIi5cIiB9KSxcbiAgICAvLyBCVUlMRC0zOiBidW5kbGUgdmlzdWFsaXplciAob25seSBpbiBhbmFseXplIG1vZGUpXG4gICAgbW9kZSA9PT0gXCJhbmFseXplXCIgJiYgdmlzdWFsaXplcih7IG9wZW46IHRydWUsIGZpbGVuYW1lOiBcImJ1bmRsZS1zdGF0cy5odG1sXCIsIGd6aXBTaXplOiB0cnVlIH0pLFxuICBdLmZpbHRlcihCb29sZWFuKSxcbiAgYnVpbGQ6IHtcbiAgICAvLyBCVUlMRC0xOiBUZXJzZXIgbWluaWZpY2F0aW9uIHdpdGggY29uc29sZS9kZWJ1Z2dlciByZW1vdmFsIGluIHByb2R1Y3Rpb25cbiAgICBtaW5pZnk6IFwidGVyc2VyXCIsXG4gICAgdGVyc2VyT3B0aW9uczoge1xuICAgICAgY29tcHJlc3M6IHtcbiAgICAgICAgZHJvcF9jb25zb2xlOiBtb2RlID09PSBcInByb2R1Y3Rpb25cIixcbiAgICAgICAgZHJvcF9kZWJ1Z2dlcjogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgbWFudWFsQ2h1bmtzKGlkKSB7XG4gICAgICAgICAgLy8gQ29yZSBSZWFjdCBcdTIwMTQgc21hbGxlc3QsIG1vc3Qgc3RhYmxlLCBiZXN0IGNhY2hlZFxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9yZWFjdC9cIikgfHwgaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvcmVhY3QtZG9tL1wiKSB8fCBpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9yZWFjdC1yb3V0ZXItZG9tL1wiKSkge1xuICAgICAgICAgICAgcmV0dXJuIFwidmVuZG9yLXJlYWN0XCI7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIFJhZGl4IFVJIFx1MjAxNCBsYXJnZSwgdmVyeSBzdGFibGUsIHJhcmVseSBjaGFuZ2VzXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL0ByYWRpeC11aS9cIikpIHtcbiAgICAgICAgICAgIHJldHVybiBcInZlbmRvci1yYWRpeFwiO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBTdXBhYmFzZSBcdTIwMTQgc3RhYmxlLCBpc29sYXRlZFxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9Ac3VwYWJhc2UvXCIpKSB7XG4gICAgICAgICAgICByZXR1cm4gXCJ2ZW5kb3Itc3VwYWJhc2VcIjtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gRnJhbWVyIE1vdGlvbiBcdTIwMTQgYW5pbWF0aW9uLCBpc29sYXRlZFxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9mcmFtZXItbW90aW9uL1wiKSkge1xuICAgICAgICAgICAgcmV0dXJuIFwidmVuZG9yLWZyYW1lclwiO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBUYW5TdGFjayBRdWVyeSBcdTIwMTQgZGF0YSBmZXRjaGluZ1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9AdGFuc3RhY2svXCIpKSB7XG4gICAgICAgICAgICByZXR1cm4gXCJ2ZW5kb3ItcXVlcnlcIjtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gTHVjaWRlIGljb25zIFx1MjAxNCBsYXJnZSBpY29uIHNldFxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9sdWNpZGUtcmVhY3QvXCIpKSB7XG4gICAgICAgICAgICByZXR1cm4gXCJ2ZW5kb3ItaWNvbnNcIjtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gUmVtYWluaW5nIHV0aWxpdGllc1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9cIikpIHtcbiAgICAgICAgICAgIHJldHVybiBcInZlbmRvci1taXNjXCI7XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IFtcbiAgICAgIHsgZmluZDogXCJAL2Fzc2V0c1wiLCByZXBsYWNlbWVudDogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuLi9hc3NldHNcIikgfSxcbiAgICAgIHsgZmluZDogXCJAL2NvbXBvbmVudHNcIiwgcmVwbGFjZW1lbnQ6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmMvY29tcG9uZW50c1wiKSB9LFxuICAgICAgeyBmaW5kOiBcIkAvdWlcIiwgcmVwbGFjZW1lbnQ6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmMvdWlcIikgfSxcbiAgICAgIHsgZmluZDogXCJAXCIsIHJlcGxhY2VtZW50OiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpIH0sXG4gICAgXSxcbiAgICBkZWR1cGU6IFtcInJlYWN0XCIsIFwicmVhY3QtZG9tXCIsIFwicmVhY3QvanN4LXJ1bnRpbWVcIiwgXCJyZWFjdC9qc3gtZGV2LXJ1bnRpbWVcIiwgXCJAdGFuc3RhY2svcmVhY3QtcXVlcnlcIiwgXCJAdGFuc3RhY2svcXVlcnktY29yZVwiXSxcbiAgfSxcbn0pKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBNFEsU0FBUyxvQkFBb0I7QUFDelMsT0FBTyxXQUFXO0FBQ2xCLE9B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

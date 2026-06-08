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
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/") || id.includes("node_modules/scheduler/") || id.includes("node_modules/object-assign/")) {
            return "vendor-react";
          }
          if (id.includes("node_modules/react-router/") || id.includes("node_modules/react-router-dom/") || id.includes("node_modules/@remix-run/")) {
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJGOlxcXFxQbGF5X1R1cmZfY29weVxcXFxjb21wb25lbnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJGOlxcXFxQbGF5X1R1cmZfY29weVxcXFxjb21wb25lbnRzXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9GOi9QbGF5X1R1cmZfY29weS9jb21wb25lbnRzL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djXCI7XG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuaW1wb3J0IHsgY29tcG9uZW50VGFnZ2VyIH0gZnJvbSBcImxvdmFibGUtdGFnZ2VyXCI7XG5pbXBvcnQgdml0ZUNvbXByZXNzaW9uIGZyb20gXCJ2aXRlLXBsdWdpbi1jb21wcmVzc2lvblwiO1xuaW1wb3J0IHsgdmlzdWFsaXplciB9IGZyb20gXCJyb2xsdXAtcGx1Z2luLXZpc3VhbGl6ZXJcIjtcbmltcG9ydCB7IFZpdGVQV0EgfSBmcm9tIFwidml0ZS1wbHVnaW4tcHdhXCI7XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiAoe1xuICBzZXJ2ZXI6IHtcbiAgICBob3N0OiBcIjo6XCIsXG4gICAgcG9ydDogMzAzMCxcbiAgICBobXI6IHtcbiAgICAgIG92ZXJsYXk6IGZhbHNlLFxuICAgIH0sXG4gICAgZnM6IHtcbiAgICAgIGFsbG93OiBbJy4uJ10sXG4gICAgfSxcbiAgfSxcbiAgcGx1Z2luczogW1xuICAgIHJlYWN0KCksXG4gICAgbW9kZSA9PT0gXCJkZXZlbG9wbWVudFwiICYmIGNvbXBvbmVudFRhZ2dlcigpLFxuICAgIC8vIEJVSUxELTI6IGd6aXAgKyBicm90bGkgY29tcHJlc3Npb24gZm9yIHN0YXRpYyBhc3NldHMgKGJ1aWxkLW9ubHkpXG4gICAgbW9kZSA9PT0gXCJwcm9kdWN0aW9uXCIgJiYgdml0ZUNvbXByZXNzaW9uKHsgYWxnb3JpdGhtOiBcImd6aXBcIiwgdGhyZXNob2xkOiAxMDI0LCBvdXRwdXREaXI6IFwiLlwiIH0pLFxuICAgIG1vZGUgPT09IFwicHJvZHVjdGlvblwiICYmIHZpdGVDb21wcmVzc2lvbih7IGFsZ29yaXRobTogXCJicm90bGlDb21wcmVzc1wiLCB0aHJlc2hvbGQ6IDEwMjQsIG91dHB1dERpcjogXCIuXCIgfSksXG4gICAgLy8gQlVJTEQtMzogYnVuZGxlIHZpc3VhbGl6ZXIgKG9ubHkgaW4gYW5hbHl6ZSBtb2RlKVxuICAgIG1vZGUgPT09IFwiYW5hbHl6ZVwiICYmIHZpc3VhbGl6ZXIoeyBvcGVuOiB0cnVlLCBmaWxlbmFtZTogXCJidW5kbGUtc3RhdHMuaHRtbFwiLCBnemlwU2l6ZTogdHJ1ZSB9KSxcbiAgICBWaXRlUFdBKHtcbiAgICAgIHJlZ2lzdGVyVHlwZTogJ2F1dG9VcGRhdGUnLFxuICAgICAgaW5jbHVkZUFzc2V0czogWydmYXZpY29uLmljbycsICdhcHBsZS10b3VjaC1pY29uLnBuZycsICdtYXNrZWQtaWNvbi5zdmcnXSxcbiAgICAgIG1hbmlmZXN0OiB7XG4gICAgICAgIG5hbWU6ICdQbGF5IFR1cmYnLFxuICAgICAgICBzaG9ydF9uYW1lOiAnUGxheVR1cmYnLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ0Jvb2sgc3BvcnRzIHR1cmZzIGFuZCBqb2luIHRvdXJuYW1lbnRzIGVhc2lseScsXG4gICAgICAgIHRoZW1lX2NvbG9yOiAnIzAwMDAwMCcsXG4gICAgICAgIGJhY2tncm91bmRfY29sb3I6ICcjMDAwMDAwJyxcbiAgICAgICAgZGlzcGxheTogJ3N0YW5kYWxvbmUnLFxuICAgICAgICBpY29uczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHNyYzogJ3B3YS0xOTJ4MTkyLnBuZycsXG4gICAgICAgICAgICBzaXplczogJzE5MngxOTInLFxuICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZydcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHNyYzogJ3B3YS01MTJ4NTEyLnBuZycsXG4gICAgICAgICAgICBzaXplczogJzUxMng1MTInLFxuICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZycsXG4gICAgICAgICAgICBwdXJwb3NlOiAnYW55IG1hc2thYmxlJ1xuICAgICAgICAgIH1cbiAgICAgICAgXVxuICAgICAgfVxuICAgIH0pLFxuICBdLmZpbHRlcihCb29sZWFuKSxcbiAgYnVpbGQ6IHtcbiAgICAvLyBCVUlMRC0xOiBUZXJzZXIgbWluaWZpY2F0aW9uIHdpdGggY29uc29sZS9kZWJ1Z2dlciByZW1vdmFsIGluIHByb2R1Y3Rpb25cbiAgICBtaW5pZnk6IFwidGVyc2VyXCIsXG4gICAgdGVyc2VyT3B0aW9uczoge1xuICAgICAgY29tcHJlc3M6IHtcbiAgICAgICAgZHJvcF9jb25zb2xlOiBtb2RlID09PSBcInByb2R1Y3Rpb25cIixcbiAgICAgICAgZHJvcF9kZWJ1Z2dlcjogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgbWFudWFsQ2h1bmtzKGlkKSB7XG4gICAgICAgICAgLy8gQ29yZSBSZWFjdCBcdTIwMTQgc21hbGxlc3QsIG1vc3Qgc3RhYmxlLCBiZXN0IGNhY2hlZFxuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL3JlYWN0L1wiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvcmVhY3QtZG9tL1wiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvc2NoZWR1bGVyL1wiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvb2JqZWN0LWFzc2lnbi9cIilcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIHJldHVybiBcInZlbmRvci1yZWFjdFwiO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBSb3V0ZXJcbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICBpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9yZWFjdC1yb3V0ZXIvXCIpIHx8XG4gICAgICAgICAgICBpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9yZWFjdC1yb3V0ZXItZG9tL1wiKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvQHJlbWl4LXJ1bi9cIilcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIHJldHVybiBcInZlbmRvci1yb3V0ZXJcIjtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gUmFkaXggVUkgXHUyMDE0IGxhcmdlLCB2ZXJ5IHN0YWJsZSwgcmFyZWx5IGNoYW5nZXNcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvQHJhZGl4LXVpL1wiKSkge1xuICAgICAgICAgICAgcmV0dXJuIFwidmVuZG9yLXJhZGl4XCI7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIFN1cGFiYXNlIFx1MjAxNCBzdGFibGUsIGlzb2xhdGVkXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL0BzdXBhYmFzZS9cIikpIHtcbiAgICAgICAgICAgIHJldHVybiBcInZlbmRvci1zdXBhYmFzZVwiO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBGcmFtZXIgTW90aW9uIFx1MjAxNCBhbmltYXRpb24sIGlzb2xhdGVkXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL2ZyYW1lci1tb3Rpb24vXCIpKSB7XG4gICAgICAgICAgICByZXR1cm4gXCJ2ZW5kb3ItZnJhbWVyXCI7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIFRhblN0YWNrIFF1ZXJ5IFx1MjAxNCBkYXRhIGZldGNoaW5nXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL0B0YW5zdGFjay9cIikpIHtcbiAgICAgICAgICAgIHJldHVybiBcInZlbmRvci1xdWVyeVwiO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBMdWNpZGUgaWNvbnMgXHUyMDE0IGxhcmdlIGljb24gc2V0XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL2x1Y2lkZS1yZWFjdC9cIikpIHtcbiAgICAgICAgICAgIHJldHVybiBcInZlbmRvci1pY29uc1wiO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBSZW1haW5pbmcgdXRpbGl0aWVzXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwibm9kZV9tb2R1bGVzL1wiKSkge1xuICAgICAgICAgICAgcmV0dXJuIFwidmVuZG9yLW1pc2NcIjtcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczogW1xuICAgICAgeyBmaW5kOiBcIkAvYXNzZXRzXCIsIHJlcGxhY2VtZW50OiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4uL2Fzc2V0c1wiKSB9LFxuICAgICAgeyBmaW5kOiBcIkAvY29tcG9uZW50c1wiLCByZXBsYWNlbWVudDogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyYy9jb21wb25lbnRzXCIpIH0sXG4gICAgICB7IGZpbmQ6IFwiQC91aVwiLCByZXBsYWNlbWVudDogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyYy91aVwiKSB9LFxuICAgICAgeyBmaW5kOiBcIkBcIiwgcmVwbGFjZW1lbnQ6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmNcIikgfSxcbiAgICBdLFxuICAgIGRlZHVwZTogW1wicmVhY3RcIiwgXCJyZWFjdC1kb21cIiwgXCJyZWFjdC9qc3gtcnVudGltZVwiLCBcInJlYWN0L2pzeC1kZXYtcnVudGltZVwiLCBcIkB0YW5zdGFjay9yZWFjdC1xdWVyeVwiLCBcIkB0YW5zdGFjay9xdWVyeS1jb3JlXCJdLFxuICB9LFxufSkpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUE0USxTQUFTLG9CQUFvQjtBQUN6UyxPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBQ2pCLFNBQVMsdUJBQXVCO0FBQ2hDLE9BQU8scUJBQXFCO0FBQzVCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsZUFBZTtBQU54QixJQUFNLG1DQUFtQztBQVN6QyxJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLEtBQUssT0FBTztBQUFBLEVBQ3pDLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLEtBQUs7QUFBQSxNQUNILFNBQVM7QUFBQSxJQUNYO0FBQUEsSUFDQSxJQUFJO0FBQUEsTUFDRixPQUFPLENBQUMsSUFBSTtBQUFBLElBQ2Q7QUFBQSxFQUNGO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUEsSUFDTixTQUFTLGlCQUFpQixnQkFBZ0I7QUFBQTtBQUFBLElBRTFDLFNBQVMsZ0JBQWdCLGdCQUFnQixFQUFFLFdBQVcsUUFBUSxXQUFXLE1BQU0sV0FBVyxJQUFJLENBQUM7QUFBQSxJQUMvRixTQUFTLGdCQUFnQixnQkFBZ0IsRUFBRSxXQUFXLGtCQUFrQixXQUFXLE1BQU0sV0FBVyxJQUFJLENBQUM7QUFBQTtBQUFBLElBRXpHLFNBQVMsYUFBYSxXQUFXLEVBQUUsTUFBTSxNQUFNLFVBQVUscUJBQXFCLFVBQVUsS0FBSyxDQUFDO0FBQUEsSUFDOUYsUUFBUTtBQUFBLE1BQ04sY0FBYztBQUFBLE1BQ2QsZUFBZSxDQUFDLGVBQWUsd0JBQXdCLGlCQUFpQjtBQUFBLE1BQ3hFLFVBQVU7QUFBQSxRQUNSLE1BQU07QUFBQSxRQUNOLFlBQVk7QUFBQSxRQUNaLGFBQWE7QUFBQSxRQUNiLGFBQWE7QUFBQSxRQUNiLGtCQUFrQjtBQUFBLFFBQ2xCLFNBQVM7QUFBQSxRQUNULE9BQU87QUFBQSxVQUNMO0FBQUEsWUFDRSxLQUFLO0FBQUEsWUFDTCxPQUFPO0FBQUEsWUFDUCxNQUFNO0FBQUEsVUFDUjtBQUFBLFVBQ0E7QUFBQSxZQUNFLEtBQUs7QUFBQSxZQUNMLE9BQU87QUFBQSxZQUNQLE1BQU07QUFBQSxZQUNOLFNBQVM7QUFBQSxVQUNYO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNILEVBQUUsT0FBTyxPQUFPO0FBQUEsRUFDaEIsT0FBTztBQUFBO0FBQUEsSUFFTCxRQUFRO0FBQUEsSUFDUixlQUFlO0FBQUEsTUFDYixVQUFVO0FBQUEsUUFDUixjQUFjLFNBQVM7QUFBQSxRQUN2QixlQUFlO0FBQUEsTUFDakI7QUFBQSxJQUNGO0FBQUEsSUFDQSxlQUFlO0FBQUEsTUFDYixRQUFRO0FBQUEsUUFDTixhQUFhLElBQUk7QUFFZixjQUNFLEdBQUcsU0FBUyxxQkFBcUIsS0FDakMsR0FBRyxTQUFTLHlCQUF5QixLQUNyQyxHQUFHLFNBQVMseUJBQXlCLEtBQ3JDLEdBQUcsU0FBUyw2QkFBNkIsR0FDekM7QUFDQSxtQkFBTztBQUFBLFVBQ1Q7QUFFQSxjQUNFLEdBQUcsU0FBUyw0QkFBNEIsS0FDeEMsR0FBRyxTQUFTLGdDQUFnQyxLQUM1QyxHQUFHLFNBQVMsMEJBQTBCLEdBQ3RDO0FBQ0EsbUJBQU87QUFBQSxVQUNUO0FBRUEsY0FBSSxHQUFHLFNBQVMseUJBQXlCLEdBQUc7QUFDMUMsbUJBQU87QUFBQSxVQUNUO0FBRUEsY0FBSSxHQUFHLFNBQVMseUJBQXlCLEdBQUc7QUFDMUMsbUJBQU87QUFBQSxVQUNUO0FBRUEsY0FBSSxHQUFHLFNBQVMsNkJBQTZCLEdBQUc7QUFDOUMsbUJBQU87QUFBQSxVQUNUO0FBRUEsY0FBSSxHQUFHLFNBQVMseUJBQXlCLEdBQUc7QUFDMUMsbUJBQU87QUFBQSxVQUNUO0FBRUEsY0FBSSxHQUFHLFNBQVMsNEJBQTRCLEdBQUc7QUFDN0MsbUJBQU87QUFBQSxVQUNUO0FBRUEsY0FBSSxHQUFHLFNBQVMsZUFBZSxHQUFHO0FBQ2hDLG1CQUFPO0FBQUEsVUFDVDtBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEVBQUUsTUFBTSxZQUFZLGFBQWEsS0FBSyxRQUFRLGtDQUFXLFdBQVcsRUFBRTtBQUFBLE1BQ3RFLEVBQUUsTUFBTSxnQkFBZ0IsYUFBYSxLQUFLLFFBQVEsa0NBQVcsa0JBQWtCLEVBQUU7QUFBQSxNQUNqRixFQUFFLE1BQU0sUUFBUSxhQUFhLEtBQUssUUFBUSxrQ0FBVyxVQUFVLEVBQUU7QUFBQSxNQUNqRSxFQUFFLE1BQU0sS0FBSyxhQUFhLEtBQUssUUFBUSxrQ0FBVyxPQUFPLEVBQUU7QUFBQSxJQUM3RDtBQUFBLElBQ0EsUUFBUSxDQUFDLFNBQVMsYUFBYSxxQkFBcUIseUJBQXlCLHlCQUF5QixzQkFBc0I7QUFBQSxFQUM5SDtBQUNGLEVBQUU7IiwKICAibmFtZXMiOiBbXQp9Cg==

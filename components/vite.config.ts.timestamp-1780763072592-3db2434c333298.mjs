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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJGOlxcXFxQbGF5X1R1cmZfY29weVxcXFxjb21wb25lbnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJGOlxcXFxQbGF5X1R1cmZfY29weVxcXFxjb21wb25lbnRzXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9GOi9QbGF5X1R1cmZfY29weS9jb21wb25lbnRzL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djXCI7XG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuaW1wb3J0IHsgY29tcG9uZW50VGFnZ2VyIH0gZnJvbSBcImxvdmFibGUtdGFnZ2VyXCI7XG5pbXBvcnQgdml0ZUNvbXByZXNzaW9uIGZyb20gXCJ2aXRlLXBsdWdpbi1jb21wcmVzc2lvblwiO1xuaW1wb3J0IHsgdmlzdWFsaXplciB9IGZyb20gXCJyb2xsdXAtcGx1Z2luLXZpc3VhbGl6ZXJcIjtcblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+ICh7XG4gIHNlcnZlcjoge1xuICAgIGhvc3Q6IFwiOjpcIixcbiAgICBwb3J0OiAzMDMwLFxuICAgIGhtcjoge1xuICAgICAgb3ZlcmxheTogZmFsc2UsXG4gICAgfSxcbiAgICBmczoge1xuICAgICAgYWxsb3c6IFsnLi4nXSxcbiAgICB9LFxuICB9LFxuICBwbHVnaW5zOiBbXG4gICAgcmVhY3QoKSxcbiAgICBtb2RlID09PSBcImRldmVsb3BtZW50XCIgJiYgY29tcG9uZW50VGFnZ2VyKCksXG4gICAgLy8gQlVJTEQtMjogZ3ppcCArIGJyb3RsaSBjb21wcmVzc2lvbiBmb3Igc3RhdGljIGFzc2V0cyAoYnVpbGQtb25seSlcbiAgICBtb2RlID09PSBcInByb2R1Y3Rpb25cIiAmJiB2aXRlQ29tcHJlc3Npb24oeyBhbGdvcml0aG06IFwiZ3ppcFwiLCB0aHJlc2hvbGQ6IDEwMjQsIG91dHB1dERpcjogXCIuXCIgfSksXG4gICAgbW9kZSA9PT0gXCJwcm9kdWN0aW9uXCIgJiYgdml0ZUNvbXByZXNzaW9uKHsgYWxnb3JpdGhtOiBcImJyb3RsaUNvbXByZXNzXCIsIHRocmVzaG9sZDogMTAyNCwgb3V0cHV0RGlyOiBcIi5cIiB9KSxcbiAgICAvLyBCVUlMRC0zOiBidW5kbGUgdmlzdWFsaXplciAob25seSBpbiBhbmFseXplIG1vZGUpXG4gICAgbW9kZSA9PT0gXCJhbmFseXplXCIgJiYgdmlzdWFsaXplcih7IG9wZW46IHRydWUsIGZpbGVuYW1lOiBcImJ1bmRsZS1zdGF0cy5odG1sXCIsIGd6aXBTaXplOiB0cnVlIH0pLFxuICBdLmZpbHRlcihCb29sZWFuKSxcbiAgYnVpbGQ6IHtcbiAgICAvLyBCVUlMRC0xOiBUZXJzZXIgbWluaWZpY2F0aW9uIHdpdGggY29uc29sZS9kZWJ1Z2dlciByZW1vdmFsIGluIHByb2R1Y3Rpb25cbiAgICBtaW5pZnk6IFwidGVyc2VyXCIsXG4gICAgdGVyc2VyT3B0aW9uczoge1xuICAgICAgY29tcHJlc3M6IHtcbiAgICAgICAgZHJvcF9jb25zb2xlOiBtb2RlID09PSBcInByb2R1Y3Rpb25cIixcbiAgICAgICAgZHJvcF9kZWJ1Z2dlcjogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgbWFudWFsQ2h1bmtzKGlkKSB7XG4gICAgICAgICAgLy8gQ29yZSBSZWFjdCBcdTIwMTQgc21hbGxlc3QsIG1vc3Qgc3RhYmxlLCBiZXN0IGNhY2hlZFxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9yZWFjdC9cIikgfHwgaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvcmVhY3QtZG9tL1wiKSkge1xuICAgICAgICAgICAgcmV0dXJuIFwidmVuZG9yLXJlYWN0XCI7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIFJvdXRlclxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9yZWFjdC1yb3V0ZXItZG9tL1wiKSB8fCBpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9AcmVtaXgtcnVuL1wiKSkge1xuICAgICAgICAgICAgcmV0dXJuIFwidmVuZG9yLXJvdXRlclwiO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBSYWRpeCBVSSBcdTIwMTQgbGFyZ2UsIHZlcnkgc3RhYmxlLCByYXJlbHkgY2hhbmdlc1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlcy9AcmFkaXgtdWkvXCIpKSB7XG4gICAgICAgICAgICByZXR1cm4gXCJ2ZW5kb3ItcmFkaXhcIjtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gU3VwYWJhc2UgXHUyMDE0IHN0YWJsZSwgaXNvbGF0ZWRcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvQHN1cGFiYXNlL1wiKSkge1xuICAgICAgICAgICAgcmV0dXJuIFwidmVuZG9yLXN1cGFiYXNlXCI7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIEZyYW1lciBNb3Rpb24gXHUyMDE0IGFuaW1hdGlvbiwgaXNvbGF0ZWRcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvZnJhbWVyLW1vdGlvbi9cIikpIHtcbiAgICAgICAgICAgIHJldHVybiBcInZlbmRvci1mcmFtZXJcIjtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gVGFuU3RhY2sgUXVlcnkgXHUyMDE0IGRhdGEgZmV0Y2hpbmdcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvQHRhbnN0YWNrL1wiKSkge1xuICAgICAgICAgICAgcmV0dXJuIFwidmVuZG9yLXF1ZXJ5XCI7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIEx1Y2lkZSBpY29ucyBcdTIwMTQgbGFyZ2UgaWNvbiBzZXRcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvbHVjaWRlLXJlYWN0L1wiKSkge1xuICAgICAgICAgICAgcmV0dXJuIFwidmVuZG9yLWljb25zXCI7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIFJlbWFpbmluZyB1dGlsaXRpZXNcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJub2RlX21vZHVsZXMvXCIpKSB7XG4gICAgICAgICAgICByZXR1cm4gXCJ2ZW5kb3ItbWlzY1wiO1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiBbXG4gICAgICB7IGZpbmQ6IFwiQC9hc3NldHNcIiwgcmVwbGFjZW1lbnQ6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi4vYXNzZXRzXCIpIH0sXG4gICAgICB7IGZpbmQ6IFwiQC9jb21wb25lbnRzXCIsIHJlcGxhY2VtZW50OiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjL2NvbXBvbmVudHNcIikgfSxcbiAgICAgIHsgZmluZDogXCJAL3VpXCIsIHJlcGxhY2VtZW50OiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjL3VpXCIpIH0sXG4gICAgICB7IGZpbmQ6IFwiQFwiLCByZXBsYWNlbWVudDogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSB9LFxuICAgIF0sXG4gICAgZGVkdXBlOiBbXCJyZWFjdFwiLCBcInJlYWN0LWRvbVwiLCBcInJlYWN0L2pzeC1ydW50aW1lXCIsIFwicmVhY3QvanN4LWRldi1ydW50aW1lXCIsIFwiQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5XCIsIFwiQHRhbnN0YWNrL3F1ZXJ5LWNvcmVcIl0sXG4gIH0sXG59KSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQTRRLFNBQVMsb0JBQW9CO0FBQ3pTLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsU0FBUyx1QkFBdUI7QUFDaEMsT0FBTyxxQkFBcUI7QUFDNUIsU0FBUyxrQkFBa0I7QUFMM0IsSUFBTSxtQ0FBbUM7QUFRekMsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE9BQU87QUFBQSxFQUN6QyxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixLQUFLO0FBQUEsTUFDSCxTQUFTO0FBQUEsSUFDWDtBQUFBLElBQ0EsSUFBSTtBQUFBLE1BQ0YsT0FBTyxDQUFDLElBQUk7QUFBQSxJQUNkO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sU0FBUyxpQkFBaUIsZ0JBQWdCO0FBQUE7QUFBQSxJQUUxQyxTQUFTLGdCQUFnQixnQkFBZ0IsRUFBRSxXQUFXLFFBQVEsV0FBVyxNQUFNLFdBQVcsSUFBSSxDQUFDO0FBQUEsSUFDL0YsU0FBUyxnQkFBZ0IsZ0JBQWdCLEVBQUUsV0FBVyxrQkFBa0IsV0FBVyxNQUFNLFdBQVcsSUFBSSxDQUFDO0FBQUE7QUFBQSxJQUV6RyxTQUFTLGFBQWEsV0FBVyxFQUFFLE1BQU0sTUFBTSxVQUFVLHFCQUFxQixVQUFVLEtBQUssQ0FBQztBQUFBLEVBQ2hHLEVBQUUsT0FBTyxPQUFPO0FBQUEsRUFDaEIsT0FBTztBQUFBO0FBQUEsSUFFTCxRQUFRO0FBQUEsSUFDUixlQUFlO0FBQUEsTUFDYixVQUFVO0FBQUEsUUFDUixjQUFjLFNBQVM7QUFBQSxRQUN2QixlQUFlO0FBQUEsTUFDakI7QUFBQSxJQUNGO0FBQUEsSUFDQSxlQUFlO0FBQUEsTUFDYixRQUFRO0FBQUEsUUFDTixhQUFhLElBQUk7QUFFZixjQUFJLEdBQUcsU0FBUyxxQkFBcUIsS0FBSyxHQUFHLFNBQVMseUJBQXlCLEdBQUc7QUFDaEYsbUJBQU87QUFBQSxVQUNUO0FBRUEsY0FBSSxHQUFHLFNBQVMsZ0NBQWdDLEtBQUssR0FBRyxTQUFTLDBCQUEwQixHQUFHO0FBQzVGLG1CQUFPO0FBQUEsVUFDVDtBQUVBLGNBQUksR0FBRyxTQUFTLHlCQUF5QixHQUFHO0FBQzFDLG1CQUFPO0FBQUEsVUFDVDtBQUVBLGNBQUksR0FBRyxTQUFTLHlCQUF5QixHQUFHO0FBQzFDLG1CQUFPO0FBQUEsVUFDVDtBQUVBLGNBQUksR0FBRyxTQUFTLDZCQUE2QixHQUFHO0FBQzlDLG1CQUFPO0FBQUEsVUFDVDtBQUVBLGNBQUksR0FBRyxTQUFTLHlCQUF5QixHQUFHO0FBQzFDLG1CQUFPO0FBQUEsVUFDVDtBQUVBLGNBQUksR0FBRyxTQUFTLDRCQUE0QixHQUFHO0FBQzdDLG1CQUFPO0FBQUEsVUFDVDtBQUVBLGNBQUksR0FBRyxTQUFTLGVBQWUsR0FBRztBQUNoQyxtQkFBTztBQUFBLFVBQ1Q7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxFQUFFLE1BQU0sWUFBWSxhQUFhLEtBQUssUUFBUSxrQ0FBVyxXQUFXLEVBQUU7QUFBQSxNQUN0RSxFQUFFLE1BQU0sZ0JBQWdCLGFBQWEsS0FBSyxRQUFRLGtDQUFXLGtCQUFrQixFQUFFO0FBQUEsTUFDakYsRUFBRSxNQUFNLFFBQVEsYUFBYSxLQUFLLFFBQVEsa0NBQVcsVUFBVSxFQUFFO0FBQUEsTUFDakUsRUFBRSxNQUFNLEtBQUssYUFBYSxLQUFLLFFBQVEsa0NBQVcsT0FBTyxFQUFFO0FBQUEsSUFDN0Q7QUFBQSxJQUNBLFFBQVEsQ0FBQyxTQUFTLGFBQWEscUJBQXFCLHlCQUF5Qix5QkFBeUIsc0JBQXNCO0FBQUEsRUFDOUg7QUFDRixFQUFFOyIsCiAgIm5hbWVzIjogW10KfQo=

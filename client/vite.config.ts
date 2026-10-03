import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("recharts") || id.includes("d3-") || id.includes("victory-")) {
              return "chart-vendor";
            }
            if (id.includes("react-router") || id.includes("@remix-run")) {
              return "router-vendor";
            }
            if (id.includes("axios")) {
              return "axios-vendor";
            }
            if (id.includes("@tanstack/react-query")) {
              return "query-vendor";
            }
            if (id.includes("react-dom") || id.includes("react/")) {
              return "react-vendor";
            }
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3002",
        changeOrigin: true,
      },
      "/storage": {
        target: "http://localhost:3002",
        changeOrigin: true,
      },
    },
  },
});

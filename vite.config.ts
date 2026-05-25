import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, the bin/dev.mjs script sets SIDEQUESTS_API_PORT before starting Vite.
// Fall back to 3000 for `npm run dev:spa` standalone use.
const apiPort = process.env.SIDEQUESTS_API_PORT || "3000";
const apiTarget = `http://127.0.0.1:${apiPort}`;

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  define: {
    // Expose API URL so SSE connections can bypass Vite's buffering proxy
    'import.meta.env.VITE_API_URL': JSON.stringify(apiTarget),
  },
});
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "bin/__tests__/*.test.ts"],
    exclude: ["src/**/*.integration.test.ts", "bin/__tests__/*.integration.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

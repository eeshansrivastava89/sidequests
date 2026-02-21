import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["src/**/*.integration.test.ts", "bin/__tests__/*.integration.test.ts"],
    globalSetup: "src/lib/__tests__/helpers/global-setup.ts",
    fileParallelism: false,
    testTimeout: 15000,
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

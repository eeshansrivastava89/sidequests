import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";

describe("app-paths", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Isolate each test: clear relevant env vars and reset cache
    delete process.env.APP_DATA_DIR;
    delete process.env.DATABASE_URL;
    delete process.env.PIPELINE_DIR;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  async function loadFresh() {
    // Dynamic import + resetPaths to avoid cached state between tests
    const mod = await import("@/lib/app-paths");
    mod.resetPaths();
    return mod;
  }

  describe("dev mode (no APP_DATA_DIR)", () => {
    it("resolves dataDir to cwd", async () => {
      const { paths } = await loadFresh();
      expect(paths.dataDir).toBe(process.cwd());
    });

    it("resolves dbUrl relative to cwd", async () => {
      const { paths } = await loadFresh();
      const expected = `file:${path.resolve(process.cwd(), "./dev.db")}`;
      expect(paths.dbUrl).toBe(expected);
    });

    it("resolves settingsPath to cwd/settings.json", async () => {
      const { paths } = await loadFresh();
      expect(paths.settingsPath).toBe(path.join(process.cwd(), "settings.json"));
    });

    it("resolves pipelineDir to cwd/pipeline", async () => {
      const { paths } = await loadFresh();
      expect(paths.pipelineDir).toBe(path.resolve(process.cwd(), "pipeline"));
    });
  });

  describe("APP_DATA_DIR mode", () => {
    it("resolves dataDir to APP_DATA_DIR", async () => {
      process.env.APP_DATA_DIR = "/tmp/pd-test";
      const { paths } = await loadFresh();
      expect(paths.dataDir).toBe("/tmp/pd-test");
    });

    it("resolves dbUrl relative to APP_DATA_DIR", async () => {
      process.env.APP_DATA_DIR = "/tmp/pd-test";
      const { paths } = await loadFresh();
      expect(paths.dbUrl).toBe(`file:${path.resolve("/tmp/pd-test", "./dev.db")}`);
    });

    it("resolves settingsPath under APP_DATA_DIR", async () => {
      process.env.APP_DATA_DIR = "/tmp/pd-test";
      const { paths } = await loadFresh();
      expect(paths.settingsPath).toBe(path.join("/tmp/pd-test", "settings.json"));
    });

    it("resolves pipelineDir to APP_DATA_DIR/pipeline", async () => {
      process.env.APP_DATA_DIR = "/tmp/pd-test";
      const { paths } = await loadFresh();
      expect(paths.pipelineDir).toBe(path.resolve("/tmp/pd-test", "pipeline"));
    });
  });

  describe("DATABASE_URL override", () => {
    it("resolves relative DATABASE_URL to dataDir", async () => {
      process.env.APP_DATA_DIR = "/tmp/pd-test";
      process.env.DATABASE_URL = "file:./custom.db";
      const { paths } = await loadFresh();
      expect(paths.dbUrl).toBe(`file:${path.resolve("/tmp/pd-test", "./custom.db")}`);
    });

    it("preserves absolute DATABASE_URL", async () => {
      process.env.APP_DATA_DIR = "/tmp/pd-test";
      process.env.DATABASE_URL = "file:/absolute/path/db.sqlite";
      const { paths } = await loadFresh();
      expect(paths.dbUrl).toBe("file:/absolute/path/db.sqlite");
      expect(paths.dbPath).toBe("/absolute/path/db.sqlite");
    });
  });

  describe("PIPELINE_DIR override", () => {
    it("respects PIPELINE_DIR in dev mode", async () => {
      process.env.PIPELINE_DIR = "/custom/pipeline";
      const { paths } = await loadFresh();
      expect(paths.pipelineDir).toBe("/custom/pipeline");
    });

    it("respects PIPELINE_DIR in APP_DATA_DIR mode", async () => {
      process.env.APP_DATA_DIR = "/tmp/pd-test";
      process.env.PIPELINE_DIR = "/custom/pipeline";
      const { paths } = await loadFresh();
      expect(paths.pipelineDir).toBe("/custom/pipeline");
    });
  });

  describe("resetPaths", () => {
    it("clears cached paths so env changes take effect", async () => {
      const mod = await loadFresh();
      const first = mod.paths.dataDir;
      expect(first).toBe(process.cwd());

      process.env.APP_DATA_DIR = "/tmp/pd-reset-test";
      mod.resetPaths();
      expect(mod.paths.dataDir).toBe("/tmp/pd-reset-test");
    });
  });
});

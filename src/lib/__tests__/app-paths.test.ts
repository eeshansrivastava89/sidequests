import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs";

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

    it("isDesktopMode is false", async () => {
      const { paths } = await loadFresh();
      expect(paths.isDesktopMode).toBe(false);
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

  describe("desktop mode (APP_DATA_DIR set)", () => {
    it("resolves dataDir to APP_DATA_DIR", async () => {
      process.env.APP_DATA_DIR = "/tmp/pd-test";
      const { paths } = await loadFresh();
      expect(paths.dataDir).toBe("/tmp/pd-test");
    });

    it("isDesktopMode is true", async () => {
      process.env.APP_DATA_DIR = "/tmp/pd-test";
      const { paths } = await loadFresh();
      expect(paths.isDesktopMode).toBe(true);
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

    it("falls back pipelineDir to cwd/pipeline when APP_DATA_DIR/pipeline has no scripts", async () => {
      process.env.APP_DATA_DIR = "/tmp/pd-test-no-scripts";
      fs.mkdirSync("/tmp/pd-test-no-scripts", { recursive: true });
      const { paths } = await loadFresh();
      // cwd/pipeline contains scan.py (the real repo), so fallback should find it
      expect(paths.pipelineDir).toBe(path.resolve(process.cwd(), "pipeline"));
    });

    it("prefers APP_DATA_DIR/pipeline when scan.py exists there", async () => {
      const testDir = "/tmp/pd-test-with-scripts";
      const pipeDir = path.join(testDir, "pipeline");
      fs.mkdirSync(pipeDir, { recursive: true });
      fs.writeFileSync(path.join(pipeDir, "scan.py"), "# stub");
      try {
        process.env.APP_DATA_DIR = testDir;
        const { paths } = await loadFresh();
        expect(paths.pipelineDir).toBe(pipeDir);
      } finally {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    });

    it("throws with remediation message when no pipeline scripts found anywhere", async () => {
      // Point both APP_DATA_DIR and cwd override to empty dirs
      const emptyDir = "/tmp/pd-test-empty-pipeline";
      fs.mkdirSync(emptyDir, { recursive: true });
      process.env.APP_DATA_DIR = emptyDir;
      // Override cwd to an empty temp dir so cwd/pipeline also doesn't exist
      const originalCwd = process.cwd;
      process.cwd = () => "/tmp/pd-test-nonexistent-cwd";
      try {
        const mod = await import("@/lib/app-paths");
        mod.resetPaths();
        expect(() => mod.paths.pipelineDir).toThrow("Pipeline scripts not found");
        expect(() => mod.paths.pipelineDir).toThrow("PIPELINE_DIR");
      } finally {
        process.cwd = originalCwd;
        fs.rmSync(emptyDir, { recursive: true, force: true });
      }
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

    it("respects PIPELINE_DIR in desktop mode", async () => {
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

  describe("defaultDesktopDataDir", () => {
    it("returns a non-empty string", async () => {
      const { defaultDesktopDataDir } = await loadFresh();
      const dir = defaultDesktopDataDir();
      expect(dir).toBeTruthy();
      expect(dir).toContain("ProjectsDashboard");
    });
  });
});

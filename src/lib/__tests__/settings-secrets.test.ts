import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

describe("settings — secret key stripping", () => {
  const tmpDir = path.join(os.tmpdir(), "pd-settings-test-" + Date.now());
  const originalEnv = { ...process.env };

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
    process.env.APP_DATA_DIR = tmpDir;
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function loadFresh() {
    const appPaths = await import("@/lib/app-paths");
    appPaths.resetPaths();
    // Clear settings cache by re-importing
    const settings = await import("@/lib/settings");
    settings.clearSettingsCache();
    return settings;
  }

  it("writeSettings strips openrouterApiKey from disk", async () => {
    const { writeSettings } = await loadFresh();
    writeSettings({
      devRoot: "~/dev",
      openrouterApiKey: "sk-secret-key",
      llmProvider: "openrouter",
    });
    const onDisk = JSON.parse(fs.readFileSync(path.join(tmpDir, "settings.json"), "utf-8"));
    expect(onDisk.openrouterApiKey).toBeUndefined();
    expect(onDisk.devRoot).toBe("~/dev");
    expect(onDisk.llmProvider).toBe("openrouter");
  });

  it("writeSettings preserves non-secret keys", async () => {
    const { writeSettings } = await loadFresh();
    writeSettings({
      devRoot: "~/projects",
      llmConcurrency: 5,
      ollamaUrl: "http://localhost:11434",
    });
    const onDisk = JSON.parse(fs.readFileSync(path.join(tmpDir, "settings.json"), "utf-8"));
    expect(onDisk.devRoot).toBe("~/projects");
    expect(onDisk.llmConcurrency).toBe(5);
    expect(onDisk.ollamaUrl).toBe("http://localhost:11434");
  });

  it("getSettings warns when secret key found in settings.json", async () => {
    // Write a settings file with a secret key directly (simulating pre-migration state)
    fs.writeFileSync(
      path.join(tmpDir, "settings.json"),
      JSON.stringify({ openrouterApiKey: "sk-old-key", devRoot: "~/dev" })
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { getSettings, clearSettingsCache } = await loadFresh();
    clearSettingsCache();
    const settings = getSettings();
    expect(settings.openrouterApiKey).toBe("sk-old-key"); // Still reads it for compat
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("openrouterApiKey"));
    warnSpy.mockRestore();
  });

  it("SECRET_KEYS contains openrouterApiKey", async () => {
    const { SECRET_KEYS } = await loadFresh();
    expect(SECRET_KEYS).toContain("openrouterApiKey");
  });
});

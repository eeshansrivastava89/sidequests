import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

describe("settings — openrouterApiKey persistence", () => {
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
    const settings = await import("@/lib/settings");
    settings.clearSettingsCache();
    return settings;
  }

  it("writeSettings persists openrouterApiKey to disk", async () => {
    const { writeSettings } = await loadFresh();
    writeSettings({
      devRoot: "~/dev",
      openrouterApiKey: "sk-secret-key",
      llmProvider: "openrouter",
    });
    const onDisk = JSON.parse(fs.readFileSync(path.join(tmpDir, "settings.json"), "utf-8"));
    expect(onDisk.openrouterApiKey).toBe("sk-secret-key");
    expect(onDisk.devRoot).toBe("~/dev");
    expect(onDisk.llmProvider).toBe("openrouter");
  });

  it("writeSettings preserves all keys", async () => {
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

  it("getSettings reads openrouterApiKey from settings.json", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "settings.json"),
      JSON.stringify({ openrouterApiKey: "sk-from-file", devRoot: "~/dev" })
    );
    const { getSettings, clearSettingsCache } = await loadFresh();
    clearSettingsCache();
    const settings = getSettings();
    expect(settings.openrouterApiKey).toBe("sk-from-file");
    expect(settings.devRoot).toBe("~/dev");
  });
});

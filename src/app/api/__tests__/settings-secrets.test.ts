import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

const tmpDir = path.join(os.tmpdir(), "pd-settings-api-test-" + Date.now());
const originalEnv = { ...process.env };

// Mock app-paths to use tmpDir
vi.mock("@/lib/app-paths", () => {
  return {
    paths: {
      get dataDir() { return tmpDir; },
      get settingsPath() { return path.join(tmpDir, "settings.json"); },
      get dbPath() { return path.join(tmpDir, "dev.db"); },
      get dbUrl() { return `file:${path.join(tmpDir, "dev.db")}`; },
      get pipelineDir() { return path.join(tmpDir, "pipeline"); },
    },
    resetPaths: () => {},
  };
});

describe("settings API — single config source", () => {
  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function loadRoutes() {
    const { clearSettingsCache } = await import("@/lib/settings");
    clearSettingsCache();
    const route = await import("@/app/api/settings/route");
    return route;
  }

  it("GET masks openrouterApiKey when present in settings.json", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "settings.json"),
      JSON.stringify({ openrouterApiKey: "sk-real-secret" })
    );
    const { GET } = await loadRoutes();
    const res = await GET();
    const data = await res.json();
    expect(data.openrouterApiKey).toBe("***");
  });

  it("GET shows empty openrouterApiKey when not configured", async () => {
    fs.writeFileSync(path.join(tmpDir, "settings.json"), JSON.stringify({}));
    const { GET } = await loadRoutes();
    const res = await GET();
    const data = await res.json();
    expect(data.openrouterApiKey).toBe("");
  });

  it("PUT persists openrouterApiKey to settings.json", async () => {
    const { PUT } = await loadRoutes();
    const req = new Request("http://localhost/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        devRoot: "~/projects",
        openrouterApiKey: "sk-should-persist",
        llmProvider: "openrouter",
      }),
    });
    const res = await PUT(req);
    const data = await res.json();
    expect(data.ok).toBe(true);

    // Verify disk
    const onDisk = JSON.parse(fs.readFileSync(path.join(tmpDir, "settings.json"), "utf-8"));
    expect(onDisk.openrouterApiKey).toBe("sk-should-persist");
    expect(onDisk.devRoot).toBe("~/projects");
    expect(onDisk.llmProvider).toBe("openrouter");
  });

  it("PUT ignores masked placeholder '***' for openrouterApiKey", async () => {
    // Pre-populate with a real key
    fs.writeFileSync(
      path.join(tmpDir, "settings.json"),
      JSON.stringify({ openrouterApiKey: "sk-existing-key" })
    );
    const { PUT } = await loadRoutes();
    const req = new Request("http://localhost/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        devRoot: "~/dev",
        openrouterApiKey: "***",
      }),
    });
    const res = await PUT(req);
    const data = await res.json();
    expect(data.ok).toBe(true);

    // Existing key should be preserved, not overwritten with "***"
    const onDisk = JSON.parse(fs.readFileSync(path.join(tmpDir, "settings.json"), "utf-8"));
    expect(onDisk.openrouterApiKey).toBe("sk-existing-key");
  });

  it("PUT persists non-secret string keys normally", async () => {
    const { PUT } = await loadRoutes();
    const req = new Request("http://localhost/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        openrouterModel: "anthropic/claude-sonnet-4",
        ollamaUrl: "http://custom:11434",
      }),
    });
    const res = await PUT(req);
    expect((await res.json()).ok).toBe(true);

    const onDisk = JSON.parse(fs.readFileSync(path.join(tmpDir, "settings.json"), "utf-8"));
    expect(onDisk.openrouterModel).toBe("anthropic/claude-sonnet-4");
    expect(onDisk.ollamaUrl).toBe("http://custom:11434");
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

// Mock electron's safeStorage before importing secrets module
const mockEncryptString = vi.fn((str: string) => Buffer.from("ENC:" + str));
const mockDecryptString = vi.fn((buf: Buffer) => {
  const str = buf.toString();
  if (!str.startsWith("ENC:")) throw new Error("Cannot decrypt");
  return str.slice(4);
});
const mockIsEncryptionAvailable = vi.fn(() => true);

vi.mock("electron", () => ({
  safeStorage: {
    encryptString: (str: string) => mockEncryptString(str),
    decryptString: (buf: Buffer) => mockDecryptString(buf),
    isEncryptionAvailable: () => mockIsEncryptionAvailable(),
  },
}));

describe("desktop/secrets", () => {
  const tmpDir = path.join(os.tmpdir(), "pd-secrets-test-" + Date.now());

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
    mockIsEncryptionAvailable.mockReturnValue(true);
    mockEncryptString.mockClear();
    mockDecryptString.mockClear();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("setSecret + hasSecret round-trip", async () => {
    const { setSecret, hasSecret } = await import("../../desktop/secrets");
    setSecret(tmpDir, "openrouterApiKey", "sk-test-123");
    expect(hasSecret(tmpDir, "openrouterApiKey")).toBe(true);
    expect(hasSecret(tmpDir, "nonexistent")).toBe(false);
  });

  it("decryptSecretsFile returns env vars", async () => {
    const { setSecret, decryptSecretsFile } = await import("../../desktop/secrets");
    setSecret(tmpDir, "openrouterApiKey", "sk-real-key");
    const env = decryptSecretsFile(tmpDir);
    expect(env.OPENROUTER_API_KEY).toBe("sk-real-key");
  });

  it("deleteSecret removes the key", async () => {
    const { setSecret, deleteSecret, hasSecret } = await import("../../desktop/secrets");
    setSecret(tmpDir, "openrouterApiKey", "sk-test");
    expect(hasSecret(tmpDir, "openrouterApiKey")).toBe(true);
    deleteSecret(tmpDir, "openrouterApiKey");
    expect(hasSecret(tmpDir, "openrouterApiKey")).toBe(false);
  });

  it("decryptSecretsFile returns empty when no file exists", async () => {
    const { decryptSecretsFile } = await import("../../desktop/secrets");
    const env = decryptSecretsFile(tmpDir);
    expect(env).toEqual({});
  });

  it("returns empty when encryption not available", async () => {
    mockIsEncryptionAvailable.mockReturnValue(false);
    const { decryptSecretsFile, hasSecret, setSecret } = await import("../../desktop/secrets");
    setSecret(tmpDir, "openrouterApiKey", "sk-test");
    expect(hasSecret(tmpDir, "openrouterApiKey")).toBe(false);
    expect(decryptSecretsFile(tmpDir)).toEqual({});
  });

  it("migrateSettingsSecrets moves key from settings to secrets", async () => {
    const { migrateSettingsSecrets, hasSecret } = await import("../../desktop/secrets");
    // Write a settings file with plaintext secret
    const settingsPath = path.join(tmpDir, "settings.json");
    fs.writeFileSync(settingsPath, JSON.stringify({
      devRoot: "~/dev",
      openrouterApiKey: "sk-migrate-me",
      llmProvider: "openrouter",
    }));

    migrateSettingsSecrets(tmpDir);

    // Secret should be in encrypted storage
    expect(hasSecret(tmpDir, "openrouterApiKey")).toBe(true);

    // settings.json should no longer contain the key
    const updated = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    expect(updated.openrouterApiKey).toBeUndefined();
    expect(updated.devRoot).toBe("~/dev");
    expect(updated.llmProvider).toBe("openrouter");
  });

  it("migrateSettingsSecrets is idempotent (no key = no-op)", async () => {
    const { migrateSettingsSecrets } = await import("../../desktop/secrets");
    const settingsPath = path.join(tmpDir, "settings.json");
    const original = { devRoot: "~/dev", llmProvider: "claude-cli" };
    fs.writeFileSync(settingsPath, JSON.stringify(original));

    migrateSettingsSecrets(tmpDir);

    const after = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    expect(after).toEqual(original);
  });
});

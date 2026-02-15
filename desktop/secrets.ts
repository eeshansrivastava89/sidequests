import { safeStorage } from "electron";
import fs from "fs";
import path from "path";

const SECRETS_FILE = "secrets.enc";

function secretsPath(userDataPath: string): string {
  return path.join(userDataPath, SECRETS_FILE);
}

function readSecretsRaw(userDataPath: string): Record<string, string> {
  const filePath = secretsPath(userDataPath);
  if (!fs.existsSync(filePath)) return {};

  try {
    const encrypted = fs.readFileSync(filePath);
    const decrypted = safeStorage.decryptString(encrypted);
    return JSON.parse(decrypted) as Record<string, string>;
  } catch {
    console.error("[secrets] Failed to decrypt secrets.enc — returning empty");
    return {};
  }
}

function writeSecretsRaw(userDataPath: string, secrets: Record<string, string>): void {
  const filePath = secretsPath(userDataPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const encrypted = safeStorage.encryptString(JSON.stringify(secrets));
  fs.writeFileSync(filePath, encrypted);
}

/** Read and decrypt all secrets. Returns key-value pairs for env injection. */
export function decryptSecretsFile(userDataPath: string): Record<string, string> {
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn("[secrets] safeStorage encryption not available — secrets disabled");
    return {};
  }
  const raw = readSecretsRaw(userDataPath);
  // Map secret keys to env var names
  const env: Record<string, string> = {};
  if (raw.openrouterApiKey) {
    env.OPENROUTER_API_KEY = raw.openrouterApiKey;
  }
  return env;
}

/** Set a secret (encrypts to disk). */
export function setSecret(userDataPath: string, key: string, value: string): void {
  if (!safeStorage.isEncryptionAvailable()) return;
  const secrets = readSecretsRaw(userDataPath);
  secrets[key] = value;
  writeSecretsRaw(userDataPath, secrets);
}

/** Delete a secret. */
export function deleteSecret(userDataPath: string, key: string): void {
  if (!safeStorage.isEncryptionAvailable()) return;
  const secrets = readSecretsRaw(userDataPath);
  delete secrets[key];
  writeSecretsRaw(userDataPath, secrets);
}

/** Check if a secret exists (without exposing its value). */
export function hasSecret(userDataPath: string, key: string): boolean {
  if (!safeStorage.isEncryptionAvailable()) return false;
  const secrets = readSecretsRaw(userDataPath);
  return key in secrets && !!secrets[key];
}

/** Migrate plaintext secrets from settings.json to encrypted storage. */
export function migrateSettingsSecrets(userDataPath: string): void {
  if (!safeStorage.isEncryptionAvailable()) return;

  const settingsPath = path.join(userDataPath, "settings.json");
  if (!fs.existsSync(settingsPath)) return;

  try {
    const raw = fs.readFileSync(settingsPath, "utf-8");
    const settings = JSON.parse(raw) as Record<string, unknown>;

    if (typeof settings.openrouterApiKey === "string" && settings.openrouterApiKey) {
      console.log("[secrets] Migrating openrouterApiKey from settings.json to secrets.enc");
      setSecret(userDataPath, "openrouterApiKey", settings.openrouterApiKey);
      delete settings.openrouterApiKey;
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
    }
  } catch (err) {
    console.error("[secrets] Migration failed:", err);
  }
}

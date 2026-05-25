import { Router } from "express";
import fs from "node:fs";
import os from "node:os";
import { config } from "@/lib/config";
import { type AppSettings, getSettings, writeSettings, clearSettingsCache } from "@/lib/settings";

export const settingsRoute = Router();

// GET /api/settings — returns all effective config (masks API keys for UI display)
settingsRoute.get("/", (_req, res) => {
  res.json({
    devRoot: config.devRoot,
    excludeDirs: config.excludeDirs.join(", "),
    llmProvider: config.llmProvider,
    llmTimeout: config.llmTimeout / 1000,
    llmConcurrency: config.llmConcurrency,
    llmOverwriteMetadata: config.llmOverwriteMetadata,
    llmAllowUnsafe: config.llmAllowUnsafe,
    llmDebug: config.llmDebug,
    claudeCliModel: config.claudeCliModel ?? "",
    codexCliModel: config.codexCliModel ?? "",
    qwenCliModel: config.qwenCliModel ?? "",
    openrouterApiKey: config.openrouterApiKey ? "***" : "",
    openrouterModel: config.openrouterModel,
    ollamaUrl: config.ollamaUrl,
    ollamaModel: config.ollamaModel,
    mlxUrl: config.mlxUrl,
    mlxModel: config.mlxModel,
    hasCompletedOnboarding: config.hasCompletedOnboarding,
    includeNonGitDirs: config.includeNonGitDirs,
  });
});

// PUT /api/settings — merge incoming fields into settings.json
const BOOL_KEYS: (keyof AppSettings)[] = [
  "llmOverwriteMetadata", "llmAllowUnsafe", "llmDebug",
  "hasCompletedOnboarding", "includeNonGitDirs",
];
const STR_KEYS: (keyof AppSettings)[] = [
  "devRoot", "excludeDirs", "llmProvider", "claudeCliModel", "codexCliModel", "qwenCliModel",
  "openrouterApiKey", "openrouterModel",
  "ollamaUrl", "ollamaModel", "mlxUrl", "mlxModel",
];
const NUM_KEYS: (keyof AppSettings)[] = ["llmTimeout", "llmConcurrency"];

settingsRoute.put("/", async (req, res) => {
  try {
    const body = req.body;
    clearSettingsCache();
    const current = getSettings();
    const updated: AppSettings = { ...current };

    for (const key of BOOL_KEYS) {
      if (key in body && typeof body[key] === "boolean") {
        (updated as Record<string, unknown>)[key] = body[key];
      }
    }
    for (const key of STR_KEYS) {
      if (key in body && typeof body[key] === "string") {
        // Skip masked placeholders — don't overwrite real key with "***"
        if (key === "openrouterApiKey" && body[key] === "***") continue;
        (updated as Record<string, unknown>)[key] = body[key];
      }
    }
    for (const key of NUM_KEYS) {
      if (key in body && typeof body[key] === "number") {
        if (key === "llmConcurrency") {
          (updated as Record<string, unknown>)[key] = Math.max(2, Math.min(5, Math.floor(body[key])));
          continue;
        }
        (updated as Record<string, unknown>)[key] = body[key];
      }
    }

    writeSettings(updated);
    const resolvedRoot = (updated.devRoot ?? "~/dev").replace(/^~(?=$|\/)/, os.homedir());
    const devRootExists = fs.existsSync(resolvedRoot) && fs.statSync(resolvedRoot).isDirectory();
    res.json({ ok: true, devRootExists });
  } catch {
    res.status(400).json({ ok: false, error: "Invalid request body" });
  }
});
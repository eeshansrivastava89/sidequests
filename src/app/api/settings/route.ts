import { NextResponse } from "next/server";
import fs from "node:fs";
import os from "node:os";
import { config } from "@/lib/config";
import { type AppSettings, getSettings, writeSettings, clearSettingsCache } from "@/lib/settings";
/** GET — returns all effective config (settings.json defaults). Masks API keys for UI display. */
export async function GET() {
  return NextResponse.json({
    devRoot: config.devRoot,
    excludeDirs: config.excludeDirs.join(", "),
    llmProvider: config.llmProvider,

    llmTimeout: config.llmTimeout / 1000,
    llmOverwriteMetadata: config.llmOverwriteMetadata,
    llmAllowUnsafe: config.llmAllowUnsafe,
    llmDebug: config.llmDebug,
    claudeCliModel: config.claudeCliModel ?? "",
    codexCliModel: config.codexCliModel ?? "",
    openrouterApiKey: config.openrouterApiKey ? "***" : "",
    openrouterModel: config.openrouterModel,
    ollamaUrl: config.ollamaUrl,
    ollamaModel: config.ollamaModel,
    mlxUrl: config.mlxUrl,
    mlxModel: config.mlxModel,
    hasCompletedOnboarding: config.hasCompletedOnboarding,
    includeNonGitDirs: config.includeNonGitDirs,
  });
}

const BOOL_KEYS: (keyof AppSettings)[] = [
  "llmOverwriteMetadata", "llmAllowUnsafe", "llmDebug",
  "hasCompletedOnboarding", "includeNonGitDirs",
];
const STR_KEYS: (keyof AppSettings)[] = [
  "devRoot", "excludeDirs", "llmProvider", "claudeCliModel", "codexCliModel",
  "openrouterApiKey", "openrouterModel",
  "ollamaUrl", "ollamaModel", "mlxUrl", "mlxModel",
];
const NUM_KEYS: (keyof AppSettings)[] = ["llmTimeout"];

/** PUT — merge incoming fields into settings.json. */
export async function PUT(req: Request) {
  try {
    const body = await req.json();
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
        (updated as Record<string, unknown>)[key] = body[key];
      }
    }

    writeSettings(updated);
    const resolvedRoot = (updated.devRoot ?? "~/dev").replace(/^~(?=$|\/)/, os.homedir());
    const devRootExists = fs.existsSync(resolvedRoot) && fs.statSync(resolvedRoot).isDirectory();
    return NextResponse.json({ ok: true, devRootExists });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

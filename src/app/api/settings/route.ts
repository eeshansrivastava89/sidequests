import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { type AppSettings, getSettings, writeSettings, clearSettingsCache, SECRET_KEYS } from "@/lib/settings";
/** GET — returns all effective config (settings.json > env > defaults). Masks API keys. */
export async function GET() {
  return NextResponse.json({
    devRoot: config.devRoot,
    excludeDirs: config.excludeDirs.join(", "),
    sanitizePaths: config.sanitizePaths,
    featureLlm: config.featureLlm,
    featureO1: config.featureO1,
    llmProvider: config.llmProvider,
    llmConcurrency: config.llmConcurrency,
    llmOverwriteMetadata: config.llmOverwriteMetadata,
    llmAllowUnsafe: config.llmAllowUnsafe,
    llmDebug: config.llmDebug,
    claudeCliModel: config.claudeCliModel ?? "",
    // Mask secret: show "***" if present (via env var), empty string if not
    openrouterApiKey: config.openrouterApiKey ? "***" : "",
    openrouterModel: config.openrouterModel,
    ollamaUrl: config.ollamaUrl,
    ollamaModel: config.ollamaModel,
    mlxUrl: config.mlxUrl,
    mlxModel: config.mlxModel,
    hasCompletedOnboarding: config.hasCompletedOnboarding,
  });
}

const BOOL_KEYS: (keyof AppSettings)[] = [
  "sanitizePaths", "featureLlm", "featureO1",
  "llmOverwriteMetadata", "llmAllowUnsafe", "llmDebug",
  "hasCompletedOnboarding",
];
const STR_KEYS: (keyof AppSettings)[] = [
  "devRoot", "excludeDirs", "llmProvider", "claudeCliModel",
  "openrouterApiKey", "openrouterModel",
  "ollamaUrl", "ollamaModel", "mlxUrl", "mlxModel",
];
const NUM_KEYS: (keyof AppSettings)[] = ["llmConcurrency"];

/** PUT — merge incoming fields into settings.json. Secrets are NOT persisted here. */
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    clearSettingsCache();
    const current = getSettings();
    const updated: AppSettings = { ...current };
    const secretsSkipped: string[] = [];

    for (const key of BOOL_KEYS) {
      if (key in body && typeof body[key] === "boolean") {
        (updated as Record<string, unknown>)[key] = body[key];
      }
    }
    for (const key of STR_KEYS) {
      if (key in body && typeof body[key] === "string") {
        // Skip masked placeholders
        if (key === "openrouterApiKey" && body[key] === "***") continue;
        // Secret keys: never persist to settings.json — come from .env.local only.
        if ((SECRET_KEYS as string[]).includes(key)) {
          if (body[key] && body[key] !== "***") {
            secretsSkipped.push(key);
          }
          continue;
        }
        (updated as Record<string, unknown>)[key] = body[key];
      }
    }
    for (const key of NUM_KEYS) {
      if (key in body && typeof body[key] === "number") {
        (updated as Record<string, unknown>)[key] = body[key];
      }
    }

    // writeSettings already strips SECRET_KEYS as a safety net
    writeSettings(updated);
    return NextResponse.json({ ok: true, secretsSkipped });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

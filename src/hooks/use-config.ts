"use client";

import { useCallback, useEffect, useState } from "react";

export interface AppConfig {
  devRoot: string;
  excludeDirs: string;
  llmProvider: string;

  llmTimeout: number;
  llmOverwriteMetadata: boolean;
  llmAllowUnsafe: boolean;
  llmDebug: boolean;
  claudeCliModel: string;
  codexCliModel: string;
  openrouterApiKey: string;
  openrouterModel: string;
  ollamaUrl: string;
  ollamaModel: string;
  mlxUrl: string;
  mlxModel: string;
  hasCompletedOnboarding: boolean;
  includeNonGitDirs: boolean;
}

const DEFAULT: AppConfig = {
  devRoot: "~/dev",
  excludeDirs: "",
  llmProvider: "claude-cli",

  llmTimeout: 90,
  llmOverwriteMetadata: false,
  llmAllowUnsafe: false,
  llmDebug: false,
  claudeCliModel: "",
  codexCliModel: "",
  openrouterApiKey: "",
  openrouterModel: "",
  ollamaUrl: "",
  ollamaModel: "",
  mlxUrl: "",
  mlxModel: "",
  hasCompletedOnboarding: false,
  includeNonGitDirs: true,
};

export function useConfig() {
  const [config, setConfig] = useState<AppConfig>(DEFAULT);
  const [configReady, setConfigReady] = useState(false);

  const refetch = useCallback(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setConfig({ ...DEFAULT, ...data });
        setConfigReady(true);
      })
      .catch(() => {
        setConfigReady(true);
      });
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { config, configReady, refetch };
}

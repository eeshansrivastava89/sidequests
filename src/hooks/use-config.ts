"use client";

import { useEffect, useState } from "react";

interface AppConfig {
  featureLlm: boolean;
  featureO1: boolean;
  sanitizePaths: boolean;
}

const DEFAULT: AppConfig = { featureLlm: false, featureO1: false, sanitizePaths: true };

export function useConfig() {
  const [config, setConfig] = useState<AppConfig>(DEFAULT);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => setConfig(data))
      .catch(() => {});
  }, []);

  return config;
}

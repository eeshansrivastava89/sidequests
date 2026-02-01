"use client";

import { useEffect, useState } from "react";

interface AppConfig {
  featureLlm: boolean;
  featureO1: boolean;
}

const DEFAULT: AppConfig = { featureLlm: false, featureO1: false };

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

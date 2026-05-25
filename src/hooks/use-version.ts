import { useEffect, useState } from "react";

export interface VersionInfo {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
}

export function useVersion() {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);

  useEffect(() => {
    fetch("/api/version")
      .then((res) => res.json())
      .then((data) => setVersionInfo(data))
      .catch(() => {});
  }, []);

  return { versionInfo };
}
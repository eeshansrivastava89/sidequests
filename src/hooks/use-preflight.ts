import { useEffect, useState } from "react";

export type GhStatus = "ok" | "no-auth" | "no-gh" | null;

export function usePreflight() {
  const [ghStatus, setGhStatus] = useState<GhStatus>(null);

  useEffect(() => {
    fetch("/api/preflight")
      .then((res) => res.json())
      .then((data) => {
        const checks: { name: string; ok: boolean }[] = data.checks ?? [];
        const gh = checks.find((c) => c.name === "gh");
        if (!gh || !gh.ok) {
          setGhStatus("no-gh");
          return;
        }
        const ghAuth = checks.find((c) => c.name === "gh-auth");
        setGhStatus(ghAuth?.ok ? "ok" : "no-auth");
      })
      .catch(() => {});
  }, []);

  return { ghStatus };
}
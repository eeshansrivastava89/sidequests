"use client";

import { useCallback, useEffect, useState } from "react";
import type { Project } from "@/lib/types";

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (data.ok) {
        setProjects(data.projects);
        setError(null);
      } else {
        setError(data.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch projects");
    } finally {
      setLoading(false);
    }
  }, []);

  const updateOverride = useCallback(
    async (id: string, fields: Record<string, unknown>) => {
      const res = await fetch(`/api/projects/${id}/override`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (data.ok) await fetchProjects();
      return data;
    },
    [fetchProjects]
  );

  const updateMetadata = useCallback(
    async (id: string, fields: Record<string, unknown>) => {
      const res = await fetch(`/api/projects/${id}/metadata`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (data.ok) await fetchProjects();
      return data;
    },
    [fetchProjects]
  );

  const touchProject = useCallback((id: string, tool: string) => {
    // Fire-and-forget: no await, no refetch
    fetch(`/api/projects/${id}/touch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool }),
    }).catch(() => {
      // Silently ignore touch failures
    });
  }, []);

  const togglePin = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/projects/${id}/pin`, {
        method: "PATCH",
      });
      const data = await res.json();
      if (data.ok) await fetchProjects();
      return data;
    },
    [fetchProjects]
  );

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return { projects, loading, error, fetchProjects, updateOverride, updateMetadata, togglePin, touchProject };
}

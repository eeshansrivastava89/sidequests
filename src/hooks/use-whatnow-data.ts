
import { useCallback, useEffect, useState } from "react";
import type { FocusGoal, ShippedData, VisitDelta, PriorityAction, Project } from "@/lib/types";

/* ── Focus Goals ───────────────────────────────────────── */

export function useFocusGoals() {
  const [goals, setGoals] = useState<FocusGoal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGoals = useCallback(async () => {
    try {
      const res = await fetch("/api/focus");
      const data = await res.json();
      if (data.ok) setGoals(data.goals);
    } catch {
      // Silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const addGoal = useCallback(async (projectId: string, goal: string) => {
    const res = await fetch("/api/focus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, goal }),
    });
    const data = await res.json();
    if (data.ok) {
      await fetchGoals();
      return data.focus;
    }
    return null;
  }, [fetchGoals]);

  const updateGoal = useCallback(async (id: string, updates: { goal?: string; completed?: boolean }) => {
    const res = await fetch(`/api/focus/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (data.ok) {
      await fetchGoals();
    }
    return data;
  }, [fetchGoals]);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  return { goals, loading, addGoal, updateGoal, refetch: fetchGoals };
}

/* ── Shipped History ────────────────────────────────────── */

export function useShipped() {
  const [shipped, setShipped] = useState<ShippedData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchShipped = useCallback(async () => {
    try {
      const res = await fetch("/api/shipped");
      const data = await res.json();
      if (data.ok) setShipped(data);
    } catch {
      // Silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchShipped(); }, [fetchShipped]);

  return { shipped, loading };
}

/* ── Visit Delta ────────────────────────────────────────── */

export function useVisit() {
  const [visit, setVisit] = useState<VisitDelta | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDelta = useCallback(async () => {
    try {
      const res = await fetch("/api/visit");
      const data = await res.json();
      if (data.ok) setVisit(data);
    } catch {
      // Silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDelta(); }, [fetchDelta]);

  return { visit, loading, fetchDelta };
}

/* ── Dismiss Alert ──────────────────────────────────────── */

export async function dismissAlert(projectId: string, alertType: string, onDismissed?: () => void) {
  const res = await fetch(`/api/projects/${projectId}/dismiss-alert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ alertType }),
  });
  const data = await res.json();
  if (data.ok && onDismissed) onDismissed();
  return data;
}

/* ── Re-show Alert ──────────────────────────────────────── */

export async function reshowAlert(projectId: string, alertType: string, onReshown?: () => void) {
  const res = await fetch(`/api/projects/${projectId}/dismiss-alert?alertType=${encodeURIComponent(alertType)}`, {
    method: "DELETE",
  });
  const data = await res.json();
  if (data.ok && onReshown) onReshown();
  return data;
}

/* ── Aggregate Actions ──────────────────────────────────── */

/** Collect all priority actions from all projects, sorted by severity. */
export function aggregateActions(projects: Project[]): PriorityAction[] {
  const all = projects.flatMap((p) => p.actions ?? []);
  const severityRank: Record<string, number> = { high: 0, med: 1, low: 2 };
  all.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.type.localeCompare(b.type));
  return all;
}
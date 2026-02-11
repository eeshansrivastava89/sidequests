"use client";

import { useCallback, useMemo, useState } from "react";
import type { Project } from "@/lib/types";

/* ── Types ─────────────────────────────────────────────── */

export type DeltaCause =
  | "scan_changed"
  | "hygiene_up"
  | "hygiene_down"
  | "momentum_up"
  | "momentum_down"
  | "health_up"
  | "health_down"
  | "status_changed"
  | "newly_enriched"
  | "skipped_unchanged"
  | "unchanged";

export interface ProjectDelta {
  projectName: string;
  healthScore: number;
  hygieneScore: number;
  momentumScore: number;
  locEstimate: number;
  statusChanged: boolean;
  newlyEnriched: boolean;
  fieldsChanged: string[];
  deltaCause: DeltaCause[];
  semanticChanged: boolean;
  prevHygieneScore: number;
  prevMomentumScore: number;
  curHygieneScore: number;
  curMomentumScore: number;
  /* Scan-level detail for refresh panel badges */
  prevLocEstimate: number;
  curLocEstimate: number;
  dirtyChanged: boolean;
  curIsDirty: boolean;
  prevDaysInactive: number;
  curDaysInactive: number;
}

export interface DeltaSummary {
  projectsChanged: number;
  enriched: number;
  unchanged: number;
  changedNames: string[];
  enrichedNames: string[];
}

export interface DashboardDeltas {
  totalCount: number;
  dirtyCount: number;
  unpushedCount: number;
  needsAttention: number;
  avgHealth: number;
  projects: Map<string, ProjectDelta>;
  causeSummary: DeltaSummary;
}

/* ── Snapshot shape (only fields we diff) ──────────────── */

export interface ProjectSnapshot {
  healthScore: number;
  hygieneScore: number;
  momentumScore: number;
  locEstimate: number;
  status: string;
  isDirty: boolean;
  ahead: number;
  llmGeneratedAt: string | null;
  nextAction: string | null;
  purpose: string | null;
  daysInactive: number;
}

/* ── Helpers ───────────────────────────────────────────── */

export function isNeedsAttention(p: { healthScore: number; isDirty: boolean; daysInactive: number; nextAction: string | null }): boolean {
  return (
    p.healthScore < 40 ||
    (p.daysInactive > 30 && !p.nextAction) ||
    (p.isDirty && p.daysInactive > 7)
  );
}

export function snapProject(p: Project): ProjectSnapshot {
  return {
    healthScore: p.healthScore,
    hygieneScore: ((p as unknown as Record<string, unknown>).hygieneScore as number) ?? 0,
    momentumScore: ((p as unknown as Record<string, unknown>).momentumScore as number) ?? 0,
    locEstimate: p.locEstimate ?? 0,
    status: p.status,
    isDirty: p.isDirty,
    ahead: p.ahead,
    llmGeneratedAt: p.llmGeneratedAt,
    nextAction: p.nextAction,
    purpose: p.purpose,
    daysInactive: p.scan?.daysInactive ?? 0,
  };
}

export function computeCauses(old: ProjectSnapshot, cur: ProjectSnapshot, newlyEnriched: boolean): DeltaCause[] {
  const causes: DeltaCause[] = [];

  // Health score changes
  if (cur.healthScore > old.healthScore) causes.push("health_up");
  else if (cur.healthScore < old.healthScore) causes.push("health_down");

  // Hygiene score changes
  if (cur.hygieneScore > old.hygieneScore) causes.push("hygiene_up");
  else if (cur.hygieneScore < old.hygieneScore) causes.push("hygiene_down");

  // Momentum score changes
  if (cur.momentumScore > old.momentumScore) causes.push("momentum_up");
  else if (cur.momentumScore < old.momentumScore) causes.push("momentum_down");

  // Status changed
  if (cur.status !== old.status) causes.push("status_changed");

  // Scan data changed (isDirty, ahead, locEstimate, daysInactive)
  if (
    cur.isDirty !== old.isDirty ||
    cur.ahead !== old.ahead ||
    cur.locEstimate !== old.locEstimate ||
    cur.daysInactive !== old.daysInactive
  ) {
    causes.push("scan_changed");
  }

  // LLM enrichment
  if (newlyEnriched) causes.push("newly_enriched");

  // If nothing changed at all
  if (causes.length === 0) causes.push("unchanged");

  return causes;
}

/* ── Hook ──────────────────────────────────────────────── */

export function useRefreshDeltas(projects: Project[]) {
  const [snapState, setSnapState] = useState<Map<string, ProjectSnapshot> | null>(null);

  const snapshot = useCallback(() => {
    const map = new Map<string, ProjectSnapshot>();
    for (const p of projects) {
      map.set(p.id, snapProject(p));
    }
    setSnapState(map);
  }, [projects]);

  const clear = useCallback(() => {
    setSnapState(null);
  }, []);

  const deltas: DashboardDeltas | null = useMemo(() => {
    if (!snapState) return null;
    const snap = snapState;

    // Aggregate snapshot stats
    const snapArr = Array.from(snap.values());
    const snapTotal = snap.size;
    const snapDirty = snapArr.filter((s) => s.isDirty).length;
    const snapUnpushed = snapArr.filter((s) => s.ahead > 0).length;
    const snapAttention = snapArr.filter((s) => isNeedsAttention(s)).length;
    const snapAvgHealth =
      snapTotal > 0 ? Math.round(snapArr.reduce((sum, s) => sum + s.healthScore, 0) / snapTotal) : 0;

    // Current stats
    const curTotal = projects.length;
    const curDirty = projects.filter((p) => p.isDirty).length;
    const curUnpushed = projects.filter((p) => p.ahead > 0).length;
    const curAttention = projects.filter((p) => {
      const di = p.scan?.daysInactive ?? 0;
      return isNeedsAttention({ healthScore: p.healthScore, isDirty: p.isDirty, daysInactive: di, nextAction: p.nextAction });
    }).length;
    const curAvgHealth =
      curTotal > 0 ? Math.round(projects.reduce((sum, p) => sum + p.healthScore, 0) / curTotal) : 0;

    // Per-project deltas + cause summary counters
    const projectDeltas = new Map<string, ProjectDelta>();
    let projectsChanged = 0;
    let enriched = 0;
    let unchanged = 0;
    const changedNames: string[] = [];
    const enrichedNames: string[] = [];

    for (const p of projects) {
      const old = snap.get(p.id);
      const curSnap = snapProject(p);

      if (!old) {
        // New project since snapshot
        projectDeltas.set(p.id, {
          projectName: p.name,
          healthScore: 0,
          hygieneScore: 0,
          momentumScore: 0,
          locEstimate: 0,
          statusChanged: false,
          newlyEnriched: false,
          fieldsChanged: [],
          deltaCause: ["scan_changed"],
          semanticChanged: false,
          prevHygieneScore: 0,
          prevMomentumScore: 0,
          curHygieneScore: curSnap.hygieneScore,
          curMomentumScore: curSnap.momentumScore,
          prevLocEstimate: 0,
          curLocEstimate: curSnap.locEstimate,
          dirtyChanged: false,
          curIsDirty: curSnap.isDirty,
          prevDaysInactive: 0,
          curDaysInactive: curSnap.daysInactive,
        });
        projectsChanged++;
        changedNames.push(p.name);
        continue;
      }

      const changed: string[] = [];
      if (p.healthScore !== old.healthScore) changed.push("healthScore");
      if (curSnap.hygieneScore !== old.hygieneScore) changed.push("hygieneScore");
      if (curSnap.momentumScore !== old.momentumScore) changed.push("momentumScore");
      if (p.status !== old.status) changed.push("status");
      if (p.isDirty !== old.isDirty) changed.push("isDirty");
      if (p.ahead !== old.ahead) changed.push("ahead");
      const curLoc = p.locEstimate ?? 0;
      if (curLoc !== old.locEstimate) changed.push("locEstimate");

      const newlyEnriched =
        p.llmGeneratedAt !== null &&
        p.llmGeneratedAt !== old.llmGeneratedAt;

      // Semantic change: purpose or nextAction content actually changed
      const semanticChanged =
        newlyEnriched && (p.purpose !== old.purpose || p.nextAction !== old.nextAction);

      const causes = computeCauses(old, curSnap, newlyEnriched);

      // Always track the project delta (including unchanged)
      projectDeltas.set(p.id, {
        projectName: p.name,
        healthScore: p.healthScore - old.healthScore,
        hygieneScore: curSnap.hygieneScore - old.hygieneScore,
        momentumScore: curSnap.momentumScore - old.momentumScore,
        locEstimate: curLoc - old.locEstimate,
        statusChanged: p.status !== old.status,
        newlyEnriched,
        fieldsChanged: changed,
        deltaCause: causes,
        semanticChanged,
        prevHygieneScore: old.hygieneScore,
        prevMomentumScore: old.momentumScore,
        curHygieneScore: curSnap.hygieneScore,
        curMomentumScore: curSnap.momentumScore,
        prevLocEstimate: old.locEstimate,
        curLocEstimate: curLoc,
        dirtyChanged: curSnap.isDirty !== old.isDirty,
        curIsDirty: curSnap.isDirty,
        prevDaysInactive: old.daysInactive,
        curDaysInactive: curSnap.daysInactive,
      });

      // Aggregate cause summary
      const isUnchanged = causes.length === 1 && causes[0] === "unchanged";
      if (isUnchanged) {
        unchanged++;
      } else if (newlyEnriched) {
        enriched++;
        enrichedNames.push(p.name);
      } else {
        projectsChanged++;
        changedNames.push(p.name);
      }
    }

    return {
      totalCount: curTotal - snapTotal,
      dirtyCount: curDirty - snapDirty,
      unpushedCount: curUnpushed - snapUnpushed,
      needsAttention: curAttention - snapAttention,
      avgHealth: curAvgHealth - snapAvgHealth,
      projects: projectDeltas,
      causeSummary: { projectsChanged, enriched, unchanged, changedNames, enrichedNames },
    };
  }, [projects, snapState]);

  return { snapshot, deltas, clear };
}

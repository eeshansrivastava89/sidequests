/**
 * Priority action computation.
 *
 * Actions are computed on-the-fly from existing project data — never stored.
 * Each action has a source badge for trust signals.
 */

import type { MergedProject } from "./merge";

export type ActionSource = "git" | "issue" | "ai" | "stale";

export interface PriorityAction {
  type: string;        // e.g. "git-urgent", "git-warning", "issue", "llm-suggestion", "stale-decision"
  label: string;       // Human-readable description
  source: ActionSource;
  severity: "high" | "med" | "low";
  projectId: string;
  projectName: string;
}

/** Number of days considered "inactive" at various thresholds. */
const STALE_WARN = 30;
const STALE_URGENT = 60;
const STALE_CRITICAL = 90;

/**
 * Compute priority actions for a single project.
 * Returns an array of actions sorted by severity (high first).
 */
export function computeActions(project: MergedProject): PriorityAction[] {
  const actions: PriorityAction[] = [];
  const { id, name } = project;

  // ── Git-based actions ──────────────────────────────────────

  // git-urgent: dirty tree + inactive >7 days, or unpushed + inactive >7 days
  const daysInactive = project.lastCommitDate
    ? Math.floor((Date.now() - new Date(project.lastCommitDate).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  if (project.isDirty && daysInactive > 7) {
    actions.push({
      type: "git-urgent",
      label: `${daysInactive}d since last commit, ${project.dirtyFileCount} uncommitted file${project.dirtyFileCount !== 1 ? "s" : ""}`,
      source: "git",
      severity: "high",
      projectId: id,
      projectName: name,
    });
  }

  if (project.ahead > 0 && daysInactive > 7) {
    actions.push({
      type: "git-urgent",
      label: `${project.ahead} unpushed commit${project.ahead !== 1 ? "s" : ""}, ${daysInactive}d inactive`,
      source: "git",
      severity: daysInactive > 30 ? "high" : "med",
      projectId: id,
      projectName: name,
    });
  }

  // git-warning: no remote, or dirty tree < 7 days
  if (project.repoVisibility === "not-on-github" && project.isDirty) {
    actions.push({
      type: "git-warning",
      label: "No remote configured",
      source: "git",
      severity: "low",
      projectId: id,
      projectName: name,
    });
  }

  if (project.isDirty && daysInactive <= 7) {
    actions.push({
      type: "git-warning",
      label: `${project.dirtyFileCount} uncommitted file${project.dirtyFileCount !== 1 ? "s" : ""}`,
      source: "git",
      severity: "low",
      projectId: id,
      projectName: name,
    });
  }

  // ── Issue-based actions ─────────────────────────────────────

  // GitHub issues with bug labels are highest priority, then features, then chores
  if (project.openIssues > 0) {
    // Try to parse issue labels for severity
    const issues = project.issuesTopJson
      ? parseIssues(project.issuesTopJson)
      : null;

    const hasBugs = issues?.some((i) => i.labels?.some((l: string) => l.toLowerCase().includes("bug")));
    const issueLabel = hasBugs ? "bug" : "issue";

    actions.push({
      type: "issue",
      label: `${project.openIssues} open ${issueLabel}${project.openIssues !== 1 ? "s" : ""}${hasBugs ? " (bugs)" : ""}`,
      source: "issue",
      severity: hasBugs ? "high" : "med",
      projectId: id,
      projectName: name,
    });
  }

  // CI failures
  if (project.ciStatus === "failure") {
    actions.push({
      type: "issue",
      label: "CI failing",
      source: "issue",
      severity: "high",
      projectId: id,
      projectName: name,
    });
  }

  // ── AI/LLM-suggested actions ────────────────────────────────

  if (project.nextAction && project.status !== "archived") {
    actions.push({
      type: "llm-suggestion",
      label: project.nextAction,
      source: "ai",
      severity: "low",
      projectId: id,
      projectName: name,
    });
  }

  // ── Stale-decision actions ─────────────────────────────────

  if (project.status === "stale" || (project.status === "paused" && daysInactive > STALE_WARN)) {
    const severity: "high" | "med" | "low" =
      daysInactive > STALE_CRITICAL ? "high" :
      daysInactive > STALE_URGENT ? "med" : "low";

    actions.push({
      type: "stale-decision",
      label: `Inactive ${daysInactive}d — ${project.status === "stale" ? "stale" : "paused"}`,
      source: "stale",
      severity,
      projectId: id,
      projectName: name,
    });
  }

  // Sort by severity (high first), then by source for stable ordering
  const severityRank: Record<string, number> = { high: 0, med: 1, low: 2 };
  actions.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.type.localeCompare(b.type));

  return actions;
}

/** Parse GitHub issues from JSON to extract label info. */
function parseIssues(json: string): Array<{ labels?: string[] }> | null {
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed;
    return null;
  } catch {
    return null;
  }
}

/**
 * Filter out dismissed actions and snoozed projects.
 */
export function filterActions(
  actions: PriorityAction[],
  dismissedAlerts: Array<{ projectId: string; alertType: string }>,
  now: Date = new Date(),
): PriorityAction[] {
  const dismissedSet = new Set(
    dismissedAlerts.map((d) => `${d.projectId}:${d.alertType}`),
  );

  return actions.filter((a) => !dismissedSet.has(`${a.projectId}:${a.type}`));
}

/**
 * Check if a project is currently snoozed.
 */
export function isSnoozed(project: MergedProject, now: Date = new Date()): boolean {
  if (!project.snoozedUntil) return false;
  return new Date(project.snoozedUntil) > now;
}
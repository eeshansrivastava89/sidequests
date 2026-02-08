import type { Project } from "@/lib/types";

/* ── Types ─────────────────────────────────────────────── */

export type AttentionSeverity = "low" | "med" | "high";

export interface AttentionReason {
  code: string;
  label: string;
  severity: AttentionSeverity;
}

export interface AttentionResult {
  needsAttention: boolean;
  reasons: AttentionReason[];
  severity: AttentionSeverity;
}

/* ── Severity ordering ─────────────────────────────────── */

const SEVERITY_RANK: Record<AttentionSeverity, number> = {
  low: 0,
  med: 1,
  high: 2,
};

function maxSeverity(reasons: AttentionReason[]): AttentionSeverity {
  if (reasons.length === 0) return "low";
  let max: AttentionSeverity = "low";
  for (const r of reasons) {
    if (SEVERITY_RANK[r.severity] > SEVERITY_RANK[max]) {
      max = r.severity;
    }
  }
  return max;
}

/* ── Rule definitions ──────────────────────────────────── */

type Rule = (p: Project) => AttentionReason | null;

const rules: Rule[] = [
  // LOW_HYGIENE — only truly neglected projects
  (p) => {
    return p.hygieneScore < 30
      ? { code: "LOW_HYGIENE", label: "Low hygiene score", severity: "high" }
      : null;
  },

  // STALE_MOMENTUM
  (p) => {
    return p.momentumScore < 25
      ? { code: "STALE_MOMENTUM", label: "Stale momentum", severity: "med" }
      : null;
  },

  // DIRTY_AGE_GT_7 — dirty working tree for over a week
  (p) => {
    const di = p.scan?.daysInactive ?? 0;
    return p.isDirty && di > 7
      ? { code: "DIRTY_AGE_GT_7", label: "Dirty working tree for >7 days", severity: "med" }
      : null;
  },

  // NO_NEXT_ACTION_GT_30 — inactive >30 days with no planned next action
  (p) => {
    const di = p.scan?.daysInactive ?? 0;
    return di > 30 && !p.nextAction
      ? { code: "NO_NEXT_ACTION_GT_30", label: "Inactive >30 days with no next action", severity: "high" }
      : null;
  },

  // UNPUSHED_CHANGES — commits ahead of remote for >7 days inactive
  (p) => {
    const di = p.scan?.daysInactive ?? 0;
    return p.ahead > 0 && di > 7
      ? { code: "UNPUSHED_CHANGES", label: "Unpushed commits aging >7 days", severity: "low" }
      : null;
  },

  // HIGH_TODO_COUNT — 20+ TODOs in the codebase
  (p) => {
    const todoCount = p.scan?.todoCount ?? 0;
    return todoCount >= 20
      ? { code: "HIGH_TODO_COUNT", label: `${todoCount} TODOs in codebase`, severity: "low" }
      : null;
  },
];

/* ── Public API ────────────────────────────────────────── */

export function evaluateAttention(project: Project): AttentionResult {
  const reasons: AttentionReason[] = [];
  for (const rule of rules) {
    const reason = rule(project);
    if (reason) reasons.push(reason);
  }
  return {
    needsAttention: reasons.length > 0,
    reasons,
    severity: maxSeverity(reasons),
  };
}

/** Client-side mirror of MergedProject from the API. */
export interface Project {
  id: string;
  name: string;
  pathDisplay: string;
  status: string;
  healthScore: number;
  purpose: string | null;
  tags: string[];
  notableFeatures: string[];
  recommendations: string[];
  notes: string | null;
  scan: RawScan | null;
  goal: string | null;
  audience: string | null;
  successMetrics: string | null;
  nextAction: string | null;
  publishTarget: string | null;
  evidence: Record<string, unknown> | null;
  outcomes: Record<string, unknown> | null;
  lastScanned: string | null;
  updatedAt: string;
}

export interface RawScan {
  isRepo: boolean;
  lastCommitDate: string | null;
  lastCommitMessage: string | null;
  branch: string | null;
  remoteUrl: string | null;
  commitCount: number;
  daysInactive: number | null;
  languages: { primary: string | null; detected: string[] };
  files: Record<string, boolean>;
  cicd: Record<string, boolean>;
  deployment: Record<string, boolean>;
  todoCount: number;
  fixmeCount: number;
  description: string | null;
}

export type WorkflowView = "all" | "next-actions" | "publish-queue" | "stalled";

export const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  "in-progress": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  stale: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  archived: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

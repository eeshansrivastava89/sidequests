/** Client-side mirror of MergedProject from the API. */
export interface Project {
  id: string;
  name: string;
  pathDisplay: string;
  status: string;
  healthScore: number;
  hygieneScore: number;
  momentumScore: number;
  scoreBreakdown: Record<string, Record<string, number>>;
  summary: string | null;
  tags: string[];
  insights: string[];
  notes: string | null;

  // Phase 53W: LLM actionable fields
  nextAction: string | null;
  llmStatus: string | null;
  statusReason: string | null;

  // Promoted derived columns
  isDirty: boolean;
  ahead: number;
  behind: number;
  framework: string | null;
  primaryLanguage: string | null;
  branchName: string | null;
  lastCommitDate: string | null;
  locEstimate: number;

  scan: RawScan | null;

  // Scan-derived fields surfaced at top level
  recentCommits: Array<{ hash: string; message: string; date: string }>;
  scripts: string[];
  services: string[];
  packageManager: string | null;
  branchCount: number;
  stashCount: number;
  license: boolean;

  // Project-level fields
  pinned: boolean;
  lastTouchedAt: string | null;

  goal: string | null;
  audience: string | null;
  successMetrics: string | null;
  publishTarget: string | null;
  lastScanned: string | null;
  updatedAt: string;

  // Legacy fields (kept for backward compat)
  notableFeatures: string[];
  pitch: string | null;
  liveUrl: string | null;
  llmGeneratedAt: string | null;

  // Phase 52W: GitHub data
  openIssues: number;
  openPrs: number;
  ciStatus: string;
  issuesTopJson: string | null;
  prsTopJson: string | null;
  repoVisibility: string;
  githubFetchedAt: string | null;
}

export interface RawScan {
  isRepo: boolean;
  lastCommitDate: string | null;
  lastCommitMessage: string | null;
  branch: string | null;
  remoteUrl: string | null;
  commitCount: number;
  daysInactive: number | null;
  isDirty: boolean;
  languages: { primary: string | null; detected: string[] };
  files: Record<string, boolean>;
  cicd: Record<string, boolean>;
  deployment: Record<string, boolean>;
  todoCount: number;
  fixmeCount: number;
  description: string | null;
  recentCommits: Array<{ hash: string; message: string; date: string }>;
  scripts: string[];
  services: string[];
  packageManager: string | null;
  branchCount: number;
  stashCount: number;
  locEstimate: number;
  license: boolean;
  ahead: number;
  behind: number;
  framework: string | null;
  liveUrl: string | null;
}

export type WorkflowView = "all" | "active" | "paused" | "needs-attention" | "stale" | "archived";

export type SortKey = "lastCommit" | "name" | "health" | "status" | "daysInactive";

export const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  paused: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  stale: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  archived: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

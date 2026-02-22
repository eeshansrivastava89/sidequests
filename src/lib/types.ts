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

export interface PreflightCheck {
  name: string;
  ok: boolean;
  message: string;
  tier?: "required" | "optional";
}

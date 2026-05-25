import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  GitBranch,
  AlertCircle,
  GitPullRequest,
  Globe,
  Lock,
} from "lucide-react";

interface GitHubSignalsProps {
  projects: Project[];
  onSelect: (id: string) => void;
}

function CiStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "success":
      return <CheckCircle2 className="size-3.5 text-emerald-500" />;
    case "failure":
      return <XCircle className="size-3.5 text-red-500" />;
    default:
      return <HelpCircle className="size-3.5 text-muted-foreground" />;
  }
}

function CiStatusLabel({ status }: { status: string }) {
  switch (status) {
    case "success":
      return <span className="text-emerald-500">Passing</span>;
    case "failure":
      return <span className="text-red-500">Failing</span>;
    default:
      return <span className="text-muted-foreground">Unknown</span>;
  }
}

export function GitHubSignals({ projects, onSelect }: GitHubSignalsProps) {
  // Filter to projects that have GitHub data
  const ghProjects = projects.filter(
    (p) => p.repoVisibility !== "not-on-github" && p.repoVisibility !== "none"
  );

  if (ghProjects.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-4">
        No GitHub-connected projects. Run an AI scan with <code className="bg-muted px-1 rounded">gh</code> CLI authenticated to see GitHub signals.
      </p>
    );
  }

  // CI status breakdown
  const ciPassing = ghProjects.filter((p) => p.ciStatus === "success").length;
  const ciFailing = ghProjects.filter((p) => p.ciStatus === "failure").length;
  const ciUnknown = ghProjects.length - ciPassing - ciFailing;

  // Total open issues & PRs
  const totalIssues = ghProjects.reduce((s, p) => s + p.openIssues, 0);
  const totalPrs = ghProjects.reduce((s, p) => s + p.openPrs, 0);

  // Visibility breakdown
  const publicRepos = ghProjects.filter((p) => p.repoVisibility === "public").length;
  const privateRepos = ghProjects.filter((p) => p.repoVisibility === "private").length;

  // Projects with CI failing
  const failingProjects = ghProjects.filter((p) => p.ciStatus === "failure");

  // Projects with most open issues
  const topIssues = [...ghProjects]
    .filter((p) => p.openIssues > 0)
    .sort((a, b) => b.openIssues - a.openIssues)
    .slice(5);

  // Projects with open PRs
  const topPrs = [...ghProjects]
    .filter((p) => p.openPrs > 0)
    .sort((a, b) => b.openPrs - a.openPrs)
    .slice(5);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle2 className="size-3.5 text-emerald-500" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">CI Passing</span>
          </div>
          <div className="text-lg font-bold tabular-nums">{ciPassing}</div>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <XCircle className="size-3.5 text-red-500" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">CI Failing</span>
          </div>
          <div className="text-lg font-bold tabular-nums">{ciFailing}</div>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertCircle className="size-3.5 text-amber-500" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Open Issues</span>
          </div>
          <div className="text-lg font-bold tabular-nums">{totalIssues}</div>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <GitPullRequest className="size-3.5 text-blue-400" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Open PRs</span>
          </div>
          <div className="text-lg font-bold tabular-nums">{totalPrs}</div>
        </div>
      </div>

      {/* CI Failing projects */}
      {failingProjects.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-red-400 mb-1.5 flex items-center gap-1.5">
            <XCircle className="size-3" /> CI Failing
          </h4>
          <div className="space-y-1">
            {failingProjects.map((p) => (
              <button
                key={p.id}
                type="button"
                className="w-full text-left flex items-center gap-2 py-1 px-2 hover:bg-muted/30 rounded transition-colors"
                onClick={() => onSelect(p.id)}
              >
                <XCircle className="size-3 text-red-500 shrink-0" />
                <span className="text-xs font-medium">{p.name}</span>
                {p.ciStatus === "failure" && p.openIssues > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {p.openIssues} issue{p.openIssues !== 1 ? "s" : ""}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Top issues */}
      {topIssues.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-amber-500 mb-1.5 flex items-center gap-1.5">
            <AlertCircle className="size-3" /> Most Open Issues
          </h4>
          <div className="space-y-1">
            {topIssues.map((p) => (
              <button
                key={p.id}
                type="button"
                className="w-full text-left flex items-center gap-2 py-1 px-2 hover:bg-muted/30 rounded transition-colors"
                onClick={() => onSelect(p.id)}
              >
                <AlertCircle className="size-3 text-amber-500 shrink-0" />
                <span className="text-xs font-medium min-w-[100px] truncate">{p.name}</span>
                <div className="flex-1" />
                <span className="text-xs font-mono tabular-nums text-muted-foreground">{p.openIssues}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Open PRs */}
      {topPrs.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-blue-400 mb-1.5 flex items-center gap-1.5">
            <GitPullRequest className="size-3" /> Open PRs
          </h4>
          <div className="space-y-1">
            {topPrs.map((p) => (
              <button
                key={p.id}
                type="button"
                className="w-full text-left flex items-center gap-2 py-1 px-2 hover:bg-muted/30 rounded transition-colors"
                onClick={() => onSelect(p.id)}
              >
                <GitPullRequest className="size-3 text-blue-400 shrink-0" />
                <span className="text-xs font-medium min-w-[100px] truncate">{p.name}</span>
                <div className="flex-1" />
                <span className="text-xs font-mono tabular-nums text-muted-foreground">{p.openPrs}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Visibility */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Globe className="size-3" /> {publicRepos} public
        </span>
        <span className="flex items-center gap-1">
          <Lock className="size-3" /> {privateRepos} private
        </span>
        <span className="flex items-center gap-1">
          <GitBranch className="size-3" /> {ghProjects.length} repos
        </span>
      </div>
    </div>
  );
}
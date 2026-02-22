/**
 * GitHub data collection via `gh` CLI.
 *
 * Fetches issues, PRs, CI status, and repo visibility for projects
 * that have a GitHub remote. Uses GraphQL for bulk data and REST for CI.
 * Graceful fallback: if `gh` is missing or unauthed, returns empty results.
 */

import { execFileSync } from "child_process";
import { parseGitHubOwnerRepo } from "@/lib/project-helpers";
export { parseGitHubOwnerRepo };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Canonical CI status values. Matches GitHub Actions conclusion values. */
export type CiStatus = "success" | "failure" | "pending" | "none";

export interface GitHubProjectData {
  openIssues: number;
  openPrs: number;
  ciStatus: CiStatus;
  issuesJson: string | null;
  prsJson: string | null;
  repoVisibility: "public" | "private" | "not-on-github";
}

export interface GitHubSyncResult {
  fetchedAt: string;
  projects: Array<{ pathHash: string; data: GitHubProjectData }>;
  skipped: number;
  errors: number;
}

interface GitHubSyncInput {
  pathHash: string;
  remoteUrl: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function runGh(...args: string[]): string | null {
  try {
    return execFileSync("gh", args, {
      timeout: 10_000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Check if `gh` CLI is installed and authenticated.
 */
export function isGhAvailable(): boolean {
  return runGh("auth", "status") !== null;
}

/**
 * Fetch GitHub data for a single repo using GraphQL + REST.
 */
export function fetchGitHubData(ownerRepo: { owner: string; repo: string }): GitHubProjectData {
  const { owner, repo } = ownerRepo;

  // GraphQL: issues, PRs, visibility in one call
  const query = `query {
    repository(owner: "${owner}", name: "${repo}") {
      visibility
      issues(states: OPEN, first: 5, orderBy: {field: CREATED_AT, direction: DESC}) {
        totalCount
        nodes { title number }
      }
      pullRequests(states: OPEN, first: 5, orderBy: {field: CREATED_AT, direction: DESC}) {
        totalCount
        nodes { title number }
      }
    }
  }`;

  const graphqlResult = runGh("api", "graphql", "-f", `query=${query}`);

  let openIssues = 0;
  let openPrs = 0;
  let issuesJson: string | null = null;
  let prsJson: string | null = null;
  let repoVisibility: "public" | "private" = "public";

  if (graphqlResult) {
    try {
      const parsed = JSON.parse(graphqlResult);
      const repoData = parsed?.data?.repository;
      if (repoData) {
        openIssues = repoData.issues?.totalCount ?? 0;
        openPrs = repoData.pullRequests?.totalCount ?? 0;

        const issueNodes = repoData.issues?.nodes;
        if (Array.isArray(issueNodes) && issueNodes.length > 0) {
          issuesJson = JSON.stringify(issueNodes.map((n: { title: string; number: number }) => ({
            title: n.title,
            number: n.number,
          })));
        }

        const prNodes = repoData.pullRequests?.nodes;
        if (Array.isArray(prNodes) && prNodes.length > 0) {
          prsJson = JSON.stringify(prNodes.map((n: { title: string; number: number }) => ({
            title: n.title,
            number: n.number,
          })));
        }

        const vis = repoData.visibility;
        repoVisibility = vis === "PRIVATE" ? "private" : "public";
      }
    } catch {
      // Parse error — fall through with defaults
    }
  }

  // REST: CI status from latest Actions run
  let ciStatus: CiStatus = "none";
  const ciResult = runGh("api", `repos/${owner}/${repo}/actions/runs?per_page=1`);
  if (ciResult) {
    try {
      const parsed = JSON.parse(ciResult);
      const runs = parsed?.workflow_runs;
      if (Array.isArray(runs) && runs.length > 0) {
        const conclusion = runs[0].conclusion;
        const status = runs[0].status;
        if (conclusion === "success") ciStatus = "success";
        else if (conclusion === "failure") ciStatus = "failure";
        else if (status === "in_progress" || status === "queued") ciStatus = "pending";
      }
    } catch {
      // Parse error — leave as "none"
    }
  }

  return { openIssues, openPrs, ciStatus, issuesJson, prsJson, repoVisibility };
}

/**
 * Sync GitHub data for all projects. Skips non-GitHub projects.
 * Returns empty result (no crash) if `gh` is unavailable.
 */
export function syncAllGitHub(projects: GitHubSyncInput[]): GitHubSyncResult {
  const fetchedAt = new Date().toISOString();
  const result: GitHubSyncResult = { fetchedAt, projects: [], skipped: 0, errors: 0 };

  if (!isGhAvailable()) {
    result.skipped = projects.length;
    return result;
  }

  for (const project of projects) {
    const ownerRepo = project.remoteUrl ? parseGitHubOwnerRepo(project.remoteUrl) : null;

    if (!ownerRepo) {
      result.skipped++;
      result.projects.push({
        pathHash: project.pathHash,
        data: {
          openIssues: 0,
          openPrs: 0,
          ciStatus: "none",
          issuesJson: null,
          prsJson: null,
          repoVisibility: "not-on-github",
        },
      });
      continue;
    }

    try {
      const data = fetchGitHubData(ownerRepo);
      result.projects.push({ pathHash: project.pathHash, data });
    } catch (err) {
      result.errors++;
      result.projects.push({
        pathHash: project.pathHash,
        data: {
          openIssues: 0,
          openPrs: 0,
          ciStatus: "none",
          issuesJson: null,
          prsJson: null,
          repoVisibility: "not-on-github",
        },
      });
      console.error(`GitHub fetch failed for ${project.pathHash}:`, err);
    }
  }

  return result;
}

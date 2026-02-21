import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("child_process", () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from "child_process";
import {
  parseGitHubOwnerRepo,
  isGhAvailable,
  fetchGitHubData,
  syncAllGitHub,
} from "@/lib/pipeline-native/github";

const mockExecFileSync = vi.mocked(execFileSync);

beforeEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// parseGitHubOwnerRepo (pure — no mocks needed)
// ---------------------------------------------------------------------------

describe("parseGitHubOwnerRepo", () => {
  it("parses SSH URL", () => {
    expect(parseGitHubOwnerRepo("git@github.com:owner/repo.git")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  it("parses SSH URL without .git", () => {
    expect(parseGitHubOwnerRepo("git@github.com:owner/repo")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  it("parses HTTPS URL with .git", () => {
    expect(parseGitHubOwnerRepo("https://github.com/owner/repo.git")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  it("parses HTTPS URL without .git", () => {
    expect(parseGitHubOwnerRepo("https://github.com/owner/repo")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  it("returns null for non-GitHub URL", () => {
    expect(parseGitHubOwnerRepo("git@gitlab.com:owner/repo.git")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseGitHubOwnerRepo("")).toBeNull();
  });

  it("returns null for malformed URL", () => {
    expect(parseGitHubOwnerRepo("not-a-url")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isGhAvailable
// ---------------------------------------------------------------------------

describe("isGhAvailable", () => {
  it("returns true when gh auth status succeeds", () => {
    mockExecFileSync.mockReturnValueOnce("Logged in to github.com");
    expect(isGhAvailable()).toBe(true);
    expect(mockExecFileSync).toHaveBeenCalledWith(
      "gh",
      ["auth", "status"],
      expect.objectContaining({ timeout: 10_000 })
    );
  });

  it("returns false when gh auth status throws", () => {
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error("not authenticated");
    });
    expect(isGhAvailable()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// fetchGitHubData
// ---------------------------------------------------------------------------

describe("fetchGitHubData", () => {
  it("parses valid GraphQL response", () => {
    const graphqlResponse = JSON.stringify({
      data: {
        repository: {
          visibility: "PUBLIC",
          issues: {
            totalCount: 3,
            nodes: [
              { title: "Bug report", number: 1 },
              { title: "Feature request", number: 2 },
            ],
          },
          pullRequests: {
            totalCount: 1,
            nodes: [{ title: "Fix bug", number: 10 }],
          },
        },
      },
    });
    const ciResponse = JSON.stringify({
      workflow_runs: [{ conclusion: "success" }],
    });

    mockExecFileSync
      .mockReturnValueOnce(graphqlResponse) // GraphQL call
      .mockReturnValueOnce(ciResponse); // CI call

    const result = fetchGitHubData({ owner: "me", repo: "myrepo" });

    expect(result.openIssues).toBe(3);
    expect(result.openPrs).toBe(1);
    expect(result.repoVisibility).toBe("public");
    expect(result.ciStatus).toBe("success");
    expect(JSON.parse(result.issuesJson!)).toEqual([
      { title: "Bug report", number: 1 },
      { title: "Feature request", number: 2 },
    ]);
    expect(JSON.parse(result.prsJson!)).toEqual([
      { title: "Fix bug", number: 10 },
    ]);
  });

  it("returns safe defaults on gh failure", () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error("gh failed");
    });

    const result = fetchGitHubData({ owner: "me", repo: "myrepo" });

    expect(result.openIssues).toBe(0);
    expect(result.openPrs).toBe(0);
    expect(result.ciStatus).toBe("none");
    expect(result.issuesJson).toBeNull();
    expect(result.prsJson).toBeNull();
    expect(result.repoVisibility).toBe("public"); // default when graphql fails
  });

  it("maps PRIVATE visibility correctly", () => {
    const graphqlResponse = JSON.stringify({
      data: {
        repository: {
          visibility: "PRIVATE",
          issues: { totalCount: 0, nodes: [] },
          pullRequests: { totalCount: 0, nodes: [] },
        },
      },
    });

    mockExecFileSync
      .mockReturnValueOnce(graphqlResponse)
      .mockImplementationOnce(() => {
        throw new Error("no CI");
      });

    const result = fetchGitHubData({ owner: "me", repo: "myrepo" });
    expect(result.repoVisibility).toBe("private");
  });

  it('maps CI conclusion "failure" to "failure"', () => {
    mockExecFileSync
      .mockImplementationOnce(() => {
        throw new Error("graphql failed");
      })
      .mockReturnValueOnce(
        JSON.stringify({ workflow_runs: [{ conclusion: "failure" }] })
      );

    const result = fetchGitHubData({ owner: "me", repo: "myrepo" });
    expect(result.ciStatus).toBe("failure");
  });

  it('returns ciStatus "none" when no workflow runs', () => {
    mockExecFileSync
      .mockImplementationOnce(() => {
        throw new Error("graphql failed");
      })
      .mockReturnValueOnce(JSON.stringify({ workflow_runs: [] }));

    const result = fetchGitHubData({ owner: "me", repo: "myrepo" });
    expect(result.ciStatus).toBe("none");
  });
});

// ---------------------------------------------------------------------------
// syncAllGitHub
// ---------------------------------------------------------------------------

describe("syncAllGitHub", () => {
  it("skips all when gh is unavailable", () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error("not found");
    });

    const result = syncAllGitHub([
      { pathHash: "abc", remoteUrl: "git@github.com:o/r.git" },
      { pathHash: "def", remoteUrl: null },
    ]);

    expect(result.skipped).toBe(2);
    expect(result.errors).toBe(0);
    expect(result.projects).toEqual([]);
  });

  it('sets repoVisibility "not-on-github" for projects without remotes', () => {
    // First call: isGhAvailable → auth status succeeds
    mockExecFileSync.mockReturnValueOnce("Logged in");

    const result = syncAllGitHub([
      { pathHash: "no-remote", remoteUrl: null },
    ]);

    expect(result.skipped).toBe(1);
    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].data.repoVisibility).toBe("not-on-github");
  });

  it("continues after single-project error", () => {
    // isGhAvailable check
    mockExecFileSync.mockReturnValueOnce("Logged in");

    // First project: GraphQL + CI succeed
    const graphqlOk = JSON.stringify({
      data: {
        repository: {
          visibility: "PUBLIC",
          issues: { totalCount: 1, nodes: [{ title: "Bug", number: 1 }] },
          pullRequests: { totalCount: 0, nodes: [] },
        },
      },
    });
    mockExecFileSync.mockReturnValueOnce(graphqlOk); // graphql
    mockExecFileSync.mockReturnValueOnce(JSON.stringify({ workflow_runs: [] })); // CI

    // Second project: both calls fail
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error("graphql fail");
    });
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error("ci fail");
    });

    const result = syncAllGitHub([
      { pathHash: "p1", remoteUrl: "git@github.com:a/b.git" },
      { pathHash: "p2", remoteUrl: "git@github.com:c/d.git" },
    ]);

    // Both projects should be in results
    expect(result.projects).toHaveLength(2);
    expect(result.errors).toBe(0); // fetchGitHubData handles errors internally
    expect(result.projects[0].data.openIssues).toBe(1);
  });

  it("reports correct skipped/errors counts", () => {
    mockExecFileSync.mockReturnValueOnce("Logged in"); // auth

    const result = syncAllGitHub([
      { pathHash: "a", remoteUrl: null },
      { pathHash: "b", remoteUrl: "git@gitlab.com:x/y.git" },
    ]);

    expect(result.skipped).toBe(2);
    expect(result.projects).toHaveLength(2);
    expect(result.projects[0].data.repoVisibility).toBe("not-on-github");
    expect(result.projects[1].data.repoVisibility).toBe("not-on-github");
  });
});

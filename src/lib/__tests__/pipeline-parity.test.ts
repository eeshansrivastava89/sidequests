/**
 * Pipeline parity tests — validate that derive output matches Python golden baseline.
 *
 * These tests run against the synthetic fixtures in pipeline/fixtures/.
 * When the TS-native derive is implemented, add it here.
 * Until then, these tests validate the fixture integrity and Python baseline.
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

const FIXTURES_DIR = path.resolve(process.cwd(), "pipeline/fixtures");
const SCAN_INPUT = path.join(FIXTURES_DIR, "scan-input-synthetic.json");
const DERIVE_EXPECTED = path.join(FIXTURES_DIR, "derive-expected-synthetic.json");

describe("pipeline parity — fixture integrity", () => {
  it("synthetic scan input is valid JSON with expected structure", () => {
    const raw = fs.readFileSync(SCAN_INPUT, "utf-8");
    const data = JSON.parse(raw);
    expect(data.scannedAt).toBeTypeOf("string");
    expect(data.projectCount).toBe(3);
    expect(data.projects).toHaveLength(3);

    for (const p of data.projects) {
      expect(p.name).toBeTypeOf("string");
      expect(p.path).toBeTypeOf("string");
      expect(p.pathHash).toBeTypeOf("string");
      expect(p.pathHash).toHaveLength(16);
    }
  });

  it("derive expected output is valid JSON with expected structure", () => {
    const raw = fs.readFileSync(DERIVE_EXPECTED, "utf-8");
    const data = JSON.parse(raw);
    expect(data.derivedAt).toBeTypeOf("string");
    expect(data.projects).toHaveLength(3);

    for (const p of data.projects) {
      expect(p.pathHash).toBeTypeOf("string");
      expect(["active", "completed", "paused", "archived"]).toContain(p.statusAuto);
      expect(p.healthScoreAuto).toBeGreaterThanOrEqual(0);
      expect(p.healthScoreAuto).toBeLessThanOrEqual(100);
      expect(p.hygieneScoreAuto).toBeGreaterThanOrEqual(0);
      expect(p.hygieneScoreAuto).toBeLessThanOrEqual(100);
      expect(p.momentumScoreAuto).toBeGreaterThanOrEqual(0);
      expect(p.momentumScoreAuto).toBeLessThanOrEqual(100);
      expect(p.scoreBreakdownJson).toHaveProperty("hygiene");
      expect(p.scoreBreakdownJson).toHaveProperty("momentum");
      expect(Array.isArray(p.tags)).toBe(true);
      // Tags must be sorted and unique
      const sorted = [...p.tags].sort();
      expect(p.tags).toEqual(sorted);
      expect(new Set(p.tags).size).toBe(p.tags.length);
    }
  });

  it("derive expected output contains correct scores for synthetic projects", () => {
    const data = JSON.parse(fs.readFileSync(DERIVE_EXPECTED, "utf-8"));
    const byHash = new Map(data.projects.map((p: { pathHash: string }) => [p.pathHash, p]));

    // Active TS project — perfect scores
    const active = byHash.get("aaaa111122223333");
    expect(active.statusAuto).toBe("active");
    expect(active.healthScoreAuto).toBe(100);
    expect(active.hygieneScoreAuto).toBe(100);
    expect(active.momentumScoreAuto).toBe(100);

    // Paused Python project (168 days inactive) — low momentum
    const paused = byHash.get("bbbb444455556666");
    expect(paused.statusAuto).toBe("paused");
    expect(paused.momentumScoreAuto).toBe(0);

    // Archived non-git project
    const archived = byHash.get("cccc777788889999");
    expect(archived.statusAuto).toBe("archived");
  });
});

describe("pipeline parity — Python baseline validation", () => {
  it("Python derive.py produces output matching golden fixture", () => {
    const scanInput = fs.readFileSync(SCAN_INPUT, "utf-8");
    const expected = JSON.parse(fs.readFileSync(DERIVE_EXPECTED, "utf-8"));

    const actual = JSON.parse(
      execFileSync("python3", [path.resolve(process.cwd(), "pipeline/derive.py")], {
        input: scanInput,
        encoding: "utf-8",
        timeout: 10_000,
      })
    );

    expect(actual).toEqual(expected);
  });
});

/** Expected top-level keys in scan output (normalized — excludes host-dependent values). */
const SCAN_PROJECT_KEYS = [
  "name", "path", "pathHash",
  "isRepo", "lastCommitDate", "lastCommitMessage", "branch", "remoteUrl",
  "commitCount", "daysInactive", "isDirty", "untrackedCount", "modifiedCount",
  "stagedCount", "ahead", "behind", "recentCommits", "branchCount", "stashCount",
  "languages", "files", "cicd", "deployment",
  "todoCount", "fixmeCount", "description", "framework", "liveUrl",
  "scripts", "services", "locEstimate", "packageManager", "license",
].sort();

const SCAN_FILES_KEYS = [
  "readme", "tests", "env", "envExample", "dockerfile",
  "dockerCompose", "linterConfig", "license", "lockfile",
].sort();

const SCAN_CICD_KEYS = ["githubActions", "circleci", "travis", "gitlabCi"].sort();
const SCAN_DEPLOYMENT_KEYS = ["fly", "vercel", "netlify"].sort();

describe("pipeline parity — Python scan structural validation", () => {
  it("scan.py output has expected top-level shape", () => {
    const output = JSON.parse(
      execFileSync("python3", [
        path.resolve(process.cwd(), "pipeline/scan.py"),
        path.resolve(process.cwd(), "pipeline/fixtures"),
        "",
      ], { encoding: "utf-8", timeout: 15_000 })
    );

    expect(output.scannedAt).toBeTypeOf("string");
    expect(output.projectCount).toBeTypeOf("number");
    expect(Array.isArray(output.projects)).toBe(true);
    expect(output.projectCount).toBe(output.projects.length);
  });

  it("each scanned project has all required keys with correct types", () => {
    const output = JSON.parse(
      execFileSync("python3", [
        path.resolve(process.cwd(), "pipeline/scan.py"),
        path.resolve(process.cwd(), "pipeline/fixtures"),
        "",
      ], { encoding: "utf-8", timeout: 15_000 })
    );

    for (const p of output.projects) {
      // Structural key parity
      expect(Object.keys(p).sort()).toEqual(SCAN_PROJECT_KEYS);

      // Type checks (normalized — skip host-dependent values)
      expect(p.name).toBeTypeOf("string");
      expect(p.path).toBeTypeOf("string");
      expect(p.pathHash).toBeTypeOf("string");
      expect(p.pathHash).toHaveLength(16);
      expect(p.isRepo).toBeTypeOf("boolean");
      expect(p.commitCount).toBeTypeOf("number");
      expect(p.isDirty).toBeTypeOf("boolean");
      expect(p.untrackedCount).toBeTypeOf("number");
      expect(p.modifiedCount).toBeTypeOf("number");
      expect(p.stagedCount).toBeTypeOf("number");
      expect(p.ahead).toBeTypeOf("number");
      expect(p.behind).toBeTypeOf("number");
      expect(Array.isArray(p.recentCommits)).toBe(true);
      expect(p.branchCount).toBeTypeOf("number");
      expect(p.stashCount).toBeTypeOf("number");
      expect(p.todoCount).toBeTypeOf("number");
      expect(p.fixmeCount).toBeTypeOf("number");
      expect(p.locEstimate).toBeTypeOf("number");
      expect(Array.isArray(p.scripts)).toBe(true);
      expect(Array.isArray(p.services)).toBe(true);

      // Nested object key parity
      expect(Object.keys(p.files).sort()).toEqual(SCAN_FILES_KEYS);
      expect(Object.keys(p.cicd).sort()).toEqual(SCAN_CICD_KEYS);
      expect(Object.keys(p.deployment).sort()).toEqual(SCAN_DEPLOYMENT_KEYS);
      expect(Object.keys(p.languages).sort()).toEqual(["detected", "primary"]);
      expect(Array.isArray(p.languages.detected)).toBe(true);
    }
  });

  it("scan.py pathHash is deterministic for a given path", () => {
    const run1 = JSON.parse(
      execFileSync("python3", [
        path.resolve(process.cwd(), "pipeline/scan.py"),
        path.resolve(process.cwd(), "pipeline/fixtures"),
        "",
      ], { encoding: "utf-8", timeout: 15_000 })
    );
    const run2 = JSON.parse(
      execFileSync("python3", [
        path.resolve(process.cwd(), "pipeline/scan.py"),
        path.resolve(process.cwd(), "pipeline/fixtures"),
        "",
      ], { encoding: "utf-8", timeout: 15_000 })
    );

    for (let i = 0; i < run1.projects.length; i++) {
      expect(run1.projects[i].pathHash).toBe(run2.projects[i].pathHash);
      expect(run1.projects[i].name).toBe(run2.projects[i].name);
    }
  });
});

describe("pipeline parity — TypeScript derive vs Python golden baseline", () => {
  it("TS derive produces identical output to Python golden fixture", async () => {
    const scanInput = JSON.parse(fs.readFileSync(SCAN_INPUT, "utf-8"));
    const expected = JSON.parse(fs.readFileSync(DERIVE_EXPECTED, "utf-8"));
    const { deriveAll } = await import("@/lib/pipeline-native/derive");
    const actual = deriveAll(scanInput);
    expect(actual).toEqual(expected);
  });

  it("deriveTags normalizes all slashes in multi-slash language labels", async () => {
    const { deriveTags } = await import("@/lib/pipeline-native/derive");
    const project = {
      pathHash: "test",
      daysInactive: 1,
      isDirty: false,
      ahead: 0,
      branchCount: 1,
      remoteUrl: null,
      todoCount: 0,
      framework: null,
      languages: { primary: null, detected: ["Java/Kotlin/Android"] },
      files: { readme: false, tests: false, dockerfile: false, dockerCompose: false, linterConfig: false, license: false, lockfile: false },
      cicd: {},
      deployment: {},
      services: [],
    };
    const tags = deriveTags(project);
    expect(tags).toContain("java-kotlin-android");
    expect(tags).not.toContain("java-kotlin/android");
  });
});

describe("pipeline parity — TS scan error semantics", () => {
  it("scanAll throws on invalid root (matching Python error behavior)", async () => {
    const { scanAll } = await import("@/lib/pipeline-native/scan");
    expect(() => scanAll("/nonexistent/path/that/does/not/exist", [])).toThrow("Scan root not found");
  });
});

describe("pipeline parity — LOC counting", () => {
  it("TS locEstimate matches Python locEstimate for fixture projects", async () => {
    const { scanAll } = await import("@/lib/pipeline-native/scan");
    const fixturesDir = path.resolve(process.cwd(), "pipeline/fixtures");

    const tsOutput = scanAll(fixturesDir, []);
    const pyOutput = JSON.parse(
      execFileSync("python3", [
        path.resolve(process.cwd(), "pipeline/scan.py"),
        fixturesDir,
        "",
      ], { encoding: "utf-8", timeout: 15_000 })
    );

    for (const pyProject of pyOutput.projects) {
      const py = pyProject as Record<string, unknown>;
      const ts = tsOutput.projects.find((p) => p.name === py.name)!;
      expect(ts.locEstimate).toBe(py.locEstimate);
    }
  });
});

describe("pipeline parity — TypeScript scan vs Python structural baseline", () => {
  it("TS scan produces same key structure as Python scan", async () => {
    const { scanAll } = await import("@/lib/pipeline-native/scan");
    const fixturesDir = path.resolve(process.cwd(), "pipeline/fixtures");

    const tsOutput = scanAll(fixturesDir, []);
    const pyOutput = JSON.parse(
      execFileSync("python3", [
        path.resolve(process.cwd(), "pipeline/scan.py"),
        fixturesDir,
        "",
      ], { encoding: "utf-8", timeout: 15_000 })
    );

    // Same number of projects
    expect(tsOutput.projectCount).toBe(pyOutput.projectCount);

    // Same project names (sorted)
    const tsNames = tsOutput.projects.map((p) => p.name).sort();
    const pyNames = pyOutput.projects.map((p: Record<string, unknown>) => p.name).sort();
    expect(tsNames).toEqual(pyNames);

    // Same keys per project (normalized — same structure)
    for (let i = 0; i < tsOutput.projects.length; i++) {
      const tsProject = tsOutput.projects.find((p) => p.name === pyOutput.projects[i].name)!;
      const pyProject = pyOutput.projects[i];
      expect(Object.keys(tsProject).sort()).toEqual(Object.keys(pyProject).sort());
    }
  });

  it("TS scan produces same pathHash as Python scan", async () => {
    const { scanAll } = await import("@/lib/pipeline-native/scan");
    const fixturesDir = path.resolve(process.cwd(), "pipeline/fixtures");

    const tsOutput = scanAll(fixturesDir, []);
    const pyOutput = JSON.parse(
      execFileSync("python3", [
        path.resolve(process.cwd(), "pipeline/scan.py"),
        fixturesDir,
        "",
      ], { encoding: "utf-8", timeout: 15_000 })
    );

    for (const pyProject of pyOutput.projects) {
      const tsProject = tsOutput.projects.find(
        (p) => p.name === (pyProject as Record<string, unknown>).name
      );
      expect(tsProject).toBeDefined();
      expect(tsProject!.pathHash).toBe((pyProject as Record<string, unknown>).pathHash);
    }
  });

  it("TS scan produces matching non-host-dependent values", async () => {
    const { scanAll } = await import("@/lib/pipeline-native/scan");
    const fixturesDir = path.resolve(process.cwd(), "pipeline/fixtures");

    const tsOutput = scanAll(fixturesDir, []);
    const pyOutput = JSON.parse(
      execFileSync("python3", [
        path.resolve(process.cwd(), "pipeline/scan.py"),
        fixturesDir,
        "",
      ], { encoding: "utf-8", timeout: 15_000 })
    );

    for (const pyProject of pyOutput.projects) {
      const py = pyProject as Record<string, unknown>;
      const ts = tsOutput.projects.find((p) => p.name === py.name)!;

      // Deterministic fields that must match exactly
      expect(ts.path).toBe(py.path);
      expect(ts.isRepo).toBe(py.isRepo);
      expect(ts.languages).toEqual(py.languages);
      expect(ts.files).toEqual(py.files);
      expect(ts.cicd).toEqual(py.cicd);
      expect(ts.deployment).toEqual(py.deployment);
      expect(ts.description).toBe(py.description);
      expect(ts.framework).toBe(py.framework);
      expect(ts.liveUrl).toBe(py.liveUrl);
      expect(ts.scripts).toEqual(py.scripts);
      expect(ts.services).toEqual(py.services);
      expect(ts.packageManager).toBe(py.packageManager);
      expect(ts.license).toBe(py.license);
      expect(ts.todoCount).toBe(py.todoCount);
      expect(ts.fixmeCount).toBe(py.fixmeCount);
      expect(ts.locEstimate).toBe(py.locEstimate);
    }
  });
});

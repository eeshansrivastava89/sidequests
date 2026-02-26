/**
 * TypeScript-native derive — deterministic derivation of status, health score, and tags.
 *
 * Port of pipeline/derive.py. Must produce byte-identical output for the same input.
 *
 * Status rules (by daysInactive):
 *   active:   <= 14 days
 *   paused:   15-60 days
 *   stale:    61-180 days
 *   archived: > 180 days or no commits
 *
 * Hygiene score (0-95 raw -> 0-100):
 *   README: +15, Tests: +20, CI/CD: +15, Remote: +10
 *   Low TODOs (<10): +10, Deployment: +10, Linter: +5, License: +5, Lockfile: +5
 *
 * Momentum score (0-70 raw -> 0-100):
 *   Commit recency: +25 (<=7d), +20 (<=14d), +15 (<=30d), +5 (<=60d)
 *   Clean working tree (!isDirty): +20
 *   Pushed up (ahead==0): +15
 *   Low stale branches (<=3): +10
 *
 * Health score: round(0.65 * hygiene + 0.35 * momentum)
 */

export interface ScanProject {
  pathHash: string;
  daysInactive: number | null;
  isDirty: boolean;
  ahead: number;
  branchCount: number;
  remoteUrl: string | null;
  todoCount: number;
  framework: string | null;
  languages: { primary: string | null; detected: string[] };
  files: {
    readme: boolean;
    tests: boolean;
    dockerfile: boolean;
    dockerCompose: boolean;
    linterConfig: boolean;
    license: boolean;
    lockfile: boolean;
  };
  cicd: Record<string, boolean>;
  deployment: Record<string, boolean>;
  services: string[];
  [key: string]: unknown;
}

export interface DeriveProject {
  pathHash: string;
  statusAuto: "active" | "completed" | "paused" | "archived";
  healthScoreAuto: number;
  hygieneScoreAuto: number;
  momentumScoreAuto: number;
  scoreBreakdownJson: {
    hygiene: Record<string, number>;
    momentum: Record<string, number>;
  };
  tags: string[];
}

export interface DeriveOutput {
  derivedAt: string;
  projects: DeriveProject[];
}

export function deriveStatus(daysInactive: number | null): DeriveProject["statusAuto"] {
  if (daysInactive === null) return "archived";
  if (daysInactive <= 14) return "active";
  if (daysInactive <= 60) return "completed";
  if (daysInactive <= 180) return "paused";
  return "archived";
}

export function deriveHygieneScore(project: ScanProject): [number, Record<string, number>] {
  const breakdown: Record<string, number> = {};
  const files = project.files ?? {};
  const cicd = project.cicd ?? {};
  const deployment = project.deployment ?? {};

  if (files.readme) breakdown.readme = 15;
  if (files.tests) breakdown.tests = 20;
  if (Object.values(cicd).some(Boolean)) breakdown.cicd = 15;
  if (project.remoteUrl) breakdown.remote = 10;
  if ((project.todoCount ?? 0) < 10) breakdown.lowTodos = 10;
  if (Object.values(deployment).some(Boolean)) breakdown.deployment = 10;
  if (files.linterConfig) breakdown.linter = 5;
  if (files.license) breakdown.license = 5;
  if (files.lockfile) breakdown.lockfile = 5;

  const raw = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const normalized = Math.min(Math.round((raw * 100) / 95), 100);
  return [normalized, breakdown];
}

export function deriveMomentumScore(project: ScanProject): [number, Record<string, number>] {
  const breakdown: Record<string, number> = {};

  const days = project.daysInactive;
  if (days !== null) {
    if (days <= 7) breakdown.recency = 25;
    else if (days <= 14) breakdown.recency = 20;
    else if (days <= 30) breakdown.recency = 15;
    else if (days <= 60) breakdown.recency = 5;
  }

  if (!project.isDirty) breakdown.cleanTree = 20;
  if ((project.ahead ?? 0) === 0) breakdown.pushedUp = 15;
  if ((project.branchCount ?? 0) <= 3) breakdown.lowBranches = 10;

  const raw = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const normalized = Math.min(Math.round((raw * 100) / 70), 100);
  return [normalized, breakdown];
}

export function deriveTags(project: ScanProject): string[] {
  const tags: Set<string> = new Set();
  const languages = project.languages ?? { detected: [] };
  const files = project.files ?? {};
  const cicd = project.cicd ?? {};
  const deployment = project.deployment ?? {};

  for (const lang of languages.detected ?? []) {
    tags.add(lang.toLowerCase().replaceAll("/", "-"));
  }

  if (files.dockerfile || files.dockerCompose) tags.add("docker");
  if (Object.values(cicd).some(Boolean)) tags.add("ci-cd");
  if (Object.values(deployment).some(Boolean)) tags.add("deployed");
  if (files.tests) tags.add("tested");

  if (project.framework) tags.add(project.framework.toLowerCase());

  for (const service of project.services ?? []) {
    tags.add(service.toLowerCase());
  }

  return [...tags].sort();
}

export function deriveProject(project: ScanProject): DeriveProject {
  const [hygiene, hygieneBreakdown] = deriveHygieneScore(project);
  const [momentum, momentumBreakdown] = deriveMomentumScore(project);
  const health = Math.round(0.65 * hygiene + 0.35 * momentum);

  return {
    pathHash: project.pathHash,
    statusAuto: deriveStatus(project.daysInactive),
    healthScoreAuto: health,
    hygieneScoreAuto: hygiene,
    momentumScoreAuto: momentum,
    scoreBreakdownJson: {
      hygiene: hygieneBreakdown,
      momentum: momentumBreakdown,
    },
    tags: deriveTags(project),
  };
}

export function deriveAll(scanOutput: { scannedAt: string; projects: ScanProject[] }): DeriveOutput {
  return {
    derivedAt: scanOutput.scannedAt,
    projects: scanOutput.projects.map(deriveProject),
  };
}

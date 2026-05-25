/**
 * TypeScript-native derive — deterministic derivation of status, health score, and tags.
 *
 * Port of pipeline/derive.py. Must produce byte-identical output for the same input.
 * All thresholds and weights are loaded from derive-config.ts for tunability.
 */

import { deriveConfig, hygieneRawMax, momentumRawMax } from "@/config/derive-config";

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
  const { active, completed, paused } = deriveConfig.status;
  if (daysInactive <= active) return "active";
  if (daysInactive <= completed) return "completed";
  if (daysInactive <= paused) return "paused";
  return "archived";
}

export function deriveHygieneScore(project: ScanProject): [number, Record<string, number>] {
  const breakdown: Record<string, number> = {};
  const { hygiene } = deriveConfig;
  const files = project.files ?? {};
  const cicd = project.cicd ?? {};
  const deployment = project.deployment ?? {};

  if (files.readme) breakdown.readme = hygiene.readme;
  if (files.tests) breakdown.tests = hygiene.tests;
  if (Object.values(cicd).some(Boolean)) breakdown.cicd = hygiene.cicd;
  if (project.remoteUrl) breakdown.remote = hygiene.remote;
  if ((project.todoCount ?? 0) < deriveConfig.lowTodosThreshold) breakdown.lowTodos = hygiene.lowTodos;
  if (Object.values(deployment).some(Boolean)) breakdown.deployment = hygiene.deployment;
  if (files.linterConfig) breakdown.linter = hygiene.linter;
  if (files.license) breakdown.license = hygiene.license;
  if (files.lockfile) breakdown.lockfile = hygiene.lockfile;

  const raw = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const normalized = Math.min(Math.round((raw * 100) / hygieneRawMax), 100);
  return [normalized, breakdown];
}

export function deriveMomentumScore(project: ScanProject): [number, Record<string, number>] {
  const breakdown: Record<string, number> = {};
  const { momentum } = deriveConfig;

  const days = project.daysInactive;
  if (days !== null) {
    if (days <= 7) breakdown.recency = momentum.recency7d;
    else if (days <= 14) breakdown.recency = momentum.recency14d;
    else if (days <= 30) breakdown.recency = momentum.recency30d;
    else if (days <= 60) breakdown.recency = momentum.recency60d;
  }

  if (!project.isDirty) breakdown.cleanTree = momentum.cleanTree;
  if ((project.ahead ?? 0) === 0) breakdown.pushedUp = momentum.pushedUp;
  if ((project.branchCount ?? 0) <= deriveConfig.lowBranchesThreshold) breakdown.lowBranches = momentum.lowBranches;

  const raw = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const normalized = Math.min(Math.round((raw * 100) / momentumRawMax), 100);
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
  const { hygiene: hW, momentum: mW } = deriveConfig.healthWeights;
  const health = Math.round(hW * hygiene + mW * momentum);

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
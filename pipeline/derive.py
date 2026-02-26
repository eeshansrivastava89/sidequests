#!/usr/bin/env python3
"""
Deterministic derivation of status, health score, and tags from raw scan data.

Reads raw scan JSON from stdin, outputs enriched JSON to stdout.

Status rules (by daysInactive):
  - active:   <= 14 days
  - paused:   15-60 days
  - stale:    61-180 days
  - archived: > 180 days or no commits

Hygiene score (structural, slow-moving, 0-95 raw -> 0-100):
  - README: +15, Tests: +20, CI/CD: +15, Remote: +10
  - Low TODOs (<10): +10, Deployment: +10, Linter: +5, License: +5, Lockfile: +5

Momentum score (operational, fast-moving, 0-70 raw -> 0-100):
  - Commit recency: +25 (<=7d), +20 (<=14d), +15 (<=30d), +5 (<=60d)
  - Clean working tree (!isDirty): +20
  - Pushed up (ahead==0): +15
  - Low stale branches (<=3): +10

Health score (legacy, backward compatible):
  - round(0.65 * hygiene + 0.35 * momentum)
"""

import json
import sys


def derive_status(days_inactive: int | None) -> str:
    if days_inactive is None:
        return "archived"
    if days_inactive <= 14:
        return "active"
    if days_inactive <= 60:
        return "completed"
    if days_inactive <= 180:
        return "paused"
    return "archived"


def derive_hygiene_score(project: dict) -> tuple[int, dict[str, int]]:
    """Structural health signals (0-95 raw, normalized to 0-100)."""
    breakdown: dict[str, int] = {}
    files = project.get("files", {})
    cicd = project.get("cicd", {})
    deployment = project.get("deployment", {})

    if files.get("readme"):
        breakdown["readme"] = 15
    if files.get("tests"):
        breakdown["tests"] = 20
    if any(cicd.values()):
        breakdown["cicd"] = 15
    if project.get("remoteUrl"):
        breakdown["remote"] = 10
    if project.get("todoCount", 0) < 10:
        breakdown["lowTodos"] = 10
    if any(deployment.values()):
        breakdown["deployment"] = 10
    if files.get("linterConfig"):
        breakdown["linter"] = 5
    if files.get("license"):
        breakdown["license"] = 5
    if files.get("lockfile"):
        breakdown["lockfile"] = 5

    raw = sum(breakdown.values())
    normalized = min(round(raw * 100 / 95), 100)
    return normalized, breakdown


def derive_momentum_score(project: dict) -> tuple[int, dict[str, int]]:
    """Operational velocity signals (0-70 raw, normalized to 0-100)."""
    breakdown: dict[str, int] = {}

    # Commit recency
    days = project.get("daysInactive")
    if days is not None:
        if days <= 7:
            breakdown["recency"] = 25
        elif days <= 14:
            breakdown["recency"] = 20
        elif days <= 30:
            breakdown["recency"] = 15
        elif days <= 60:
            breakdown["recency"] = 5

    # Clean working tree
    if not project.get("isDirty", False):
        breakdown["cleanTree"] = 20

    # Pushed up (no commits ahead of remote)
    if project.get("ahead", 0) == 0:
        breakdown["pushedUp"] = 15

    # Low stale branches
    if project.get("branchCount", 0) <= 3:
        breakdown["lowBranches"] = 10

    raw = sum(breakdown.values())
    normalized = min(round(raw * 100 / 70), 100)
    return normalized, breakdown


def derive_health_score(project: dict) -> tuple[int, int, int, dict]:
    """Combined scoring: hygiene + momentum -> legacy healthScore."""
    hygiene, hygiene_breakdown = derive_hygiene_score(project)
    momentum, momentum_breakdown = derive_momentum_score(project)
    health = round(0.65 * hygiene + 0.35 * momentum)

    score_breakdown = {
        "hygiene": hygiene_breakdown,
        "momentum": momentum_breakdown,
    }

    return health, hygiene, momentum, score_breakdown


def derive_tags(project: dict) -> list[str]:
    tags: list[str] = []
    languages = project.get("languages", {})
    files = project.get("files", {})
    cicd = project.get("cicd", {})
    deployment = project.get("deployment", {})

    # Language-based tags
    for lang in languages.get("detected", []):
        normalized = lang.lower().replace("/", "-")
        tags.append(normalized)

    # Capability-based tags
    if files.get("dockerfile") or files.get("dockerCompose"):
        tags.append("docker")
    if any(cicd.values()):
        tags.append("ci-cd")
    if any(deployment.values()):
        tags.append("deployed")
    if files.get("tests"):
        tags.append("tested")

    # Framework-based tags (from scan's framework field)
    framework = project.get("framework")
    if framework:
        tags.append(framework.lower())

    # Service-based tags (from scan's services field)
    for service in project.get("services", []):
        tags.append(service.lower())

    return sorted(set(tags))


def derive_project(project: dict) -> dict:
    days_inactive = project.get("daysInactive")
    health, hygiene, momentum, score_breakdown = derive_health_score(project)
    return {
        "pathHash": project["pathHash"],
        "statusAuto": derive_status(days_inactive),
        "healthScoreAuto": health,
        "hygieneScoreAuto": hygiene,
        "momentumScoreAuto": momentum,
        "scoreBreakdownJson": score_breakdown,
        "tags": derive_tags(project),
    }


def main() -> None:
    raw = json.load(sys.stdin)
    projects = raw.get("projects", [])

    derived = [derive_project(p) for p in projects]

    output = {
        "derivedAt": raw.get("scannedAt"),
        "projects": derived,
    }

    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Deterministic derivation of status, health score, and tags from raw scan data.

Reads raw scan JSON from stdin, outputs enriched JSON to stdout.

Status rules (by daysInactive):
  - active:      <= 14 days
  - in-progress: 15-60 days
  - stale:       61-180 days
  - archived:    > 180 days or no commits

Health score rubric (0-100):
  - README present:      +15
  - Tests present:       +20
  - CI/CD present:       +15
  - Recent commits:      +20 (<=30 days)
  - Remote configured:   +10
  - Low TODO count:      +10 (<10 TODOs)
  - Deployment config:   +10
"""

import json
import sys


def derive_status(days_inactive: int | None) -> str:
    if days_inactive is None:
        return "archived"
    if days_inactive <= 14:
        return "active"
    if days_inactive <= 60:
        return "in-progress"
    if days_inactive <= 180:
        return "stale"
    return "archived"


def derive_health_score(project: dict) -> int:
    score = 0
    files = project.get("files", {})
    cicd = project.get("cicd", {})
    deployment = project.get("deployment", {})

    if files.get("readme"):
        score += 15
    if files.get("tests"):
        score += 20
    if any(cicd.values()):
        score += 15
    days = project.get("daysInactive")
    if days is not None and days <= 30:
        score += 20
    if project.get("remoteUrl"):
        score += 10
    if project.get("todoCount", 0) < 10:
        score += 10
    if any(deployment.values()):
        score += 10

    return score


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

    # Infer project type from indicators
    name = project.get("name", "").lower()
    if any(kw in name for kw in ["api", "server", "backend"]):
        tags.append("api")
    if any(kw in name for kw in ["web", "app", "ui", "frontend", "dashboard"]):
        tags.append("web")
    if any(kw in name for kw in ["cli", "tool", "util"]):
        tags.append("cli")
    if any(kw in name for kw in ["lib", "sdk", "package"]):
        tags.append("library")

    return sorted(set(tags))


def derive_project(project: dict) -> dict:
    days_inactive = project.get("daysInactive")
    return {
        "pathHash": project["pathHash"],
        "statusAuto": derive_status(days_inactive),
        "healthScoreAuto": derive_health_score(project),
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

#!/usr/bin/env python3
"""
Deterministic derivation of status, health score, and tags from raw scan data.

Reads raw scan JSON from stdin, outputs enriched JSON to stdout.

Status rules (by daysInactive):
  - active:   <= 14 days
  - paused:   15-60 days
  - stale:    61-180 days
  - archived: > 180 days or no commits

Health score rubric (0-110, normalized to 0-100):
  - README present:      +15
  - Tests present:       +20
  - CI/CD present:       +15
  - Recent commits:      +20 if <=7d, +15 if <=14d, +10 if <=30d, +5 if <=60d
  - Remote configured:   +10
  - Low TODO count:      +10 (<10 TODOs)
  - Deployment config:   +10
  - Linter config:       +5
  - License:             +5
  - Lockfile:            +5
"""

import json
import sys


def derive_status(days_inactive: int | None) -> str:
    if days_inactive is None:
        return "archived"
    if days_inactive <= 14:
        return "active"
    if days_inactive <= 60:
        return "paused"
    if days_inactive <= 180:
        return "stale"
    return "archived"


def derive_health_score(project: dict) -> int:
    """Gradient health scoring (0-110 raw, normalized to 0-100)."""
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

    # Gradient recency scoring
    days = project.get("daysInactive")
    if days is not None:
        if days <= 7:
            score += 20
        elif days <= 14:
            score += 15
        elif days <= 30:
            score += 10
        elif days <= 60:
            score += 5

    if project.get("remoteUrl"):
        score += 10
    if project.get("todoCount", 0) < 10:
        score += 10
    if any(deployment.values()):
        score += 10

    # New signals
    if files.get("linterConfig"):
        score += 5
    if files.get("license"):
        score += 5
    if files.get("lockfile"):
        score += 5

    # Normalize from 110 max to 100
    return min(round(score * 100 / 110), 100)


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

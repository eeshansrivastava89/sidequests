#!/usr/bin/env python3
"""
Deterministic scanner for ~/dev projects.

Collects raw git info, language indicators, file flags, TODO/FIXME counts.
Outputs JSON to stdout. Accepts DEV_ROOT and EXCLUDE_DIRS as arguments.

Usage:
    python3 scan.py <dev_root> <exclude_csv>
"""

import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

LANGUAGE_INDICATORS: dict[str, str] = {
    "package.json": "JavaScript/TypeScript",
    "pyproject.toml": "Python",
    "setup.py": "Python",
    "requirements.txt": "Python",
    "Cargo.toml": "Rust",
    "go.mod": "Go",
    "Gemfile": "Ruby",
    "build.gradle": "Java/Kotlin",
    "pom.xml": "Java",
    "mix.exs": "Elixir",
    "Package.swift": "Swift",
    "composer.json": "PHP",
}

SOURCE_EXTENSIONS: set[str] = {
    ".py", ".ts", ".tsx", ".js", ".jsx", ".rs", ".go", ".rb", ".java", ".kt",
    ".ex", ".exs", ".swift", ".php", ".c", ".cpp", ".h",
}

SKIP_WALK_DIRS: set[str] = {
    "node_modules", ".venv", ".git", "__pycache__", "dist", "build",
    ".next", "target", ".tox", "venv", "env",
}


def path_hash(absolute_path: str) -> str:
    """Stable identity hash from absolute path."""
    return hashlib.sha256(absolute_path.encode()).hexdigest()[:16]


def run_git(cwd: str, *args: str) -> str | None:
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=5,
        )
        return result.stdout.strip() if result.returncode == 0 else None
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return None


def get_git_info(path: str) -> dict:
    if not (Path(path) / ".git").exists():
        return {
            "isRepo": False,
            "lastCommitDate": None,
            "lastCommitMessage": None,
            "branch": None,
            "remoteUrl": None,
            "commitCount": 0,
            "daysInactive": None,
        }

    last_date = run_git(path, "log", "-1", "--format=%aI")
    last_msg = run_git(path, "log", "-1", "--format=%s")
    branch = run_git(path, "rev-parse", "--abbrev-ref", "HEAD")
    remote = run_git(path, "remote", "get-url", "origin")
    count_str = run_git(path, "rev-list", "--count", "HEAD")
    commit_count = int(count_str) if count_str else 0

    days_inactive = None
    if last_date:
        try:
            last_dt = datetime.fromisoformat(last_date)
            days_inactive = (datetime.now(timezone.utc) - last_dt).days
        except ValueError:
            pass

    return {
        "isRepo": True,
        "lastCommitDate": last_date,
        "lastCommitMessage": last_msg,
        "branch": branch,
        "remoteUrl": remote,
        "commitCount": commit_count,
        "daysInactive": days_inactive,
    }


def detect_languages(path: str) -> dict:
    detected: list[str] = []
    primary = None

    for indicator, lang in LANGUAGE_INDICATORS.items():
        if (Path(path) / indicator).exists():
            if lang not in detected:
                detected.append(lang)
            if primary is None:
                primary = lang

    if (Path(path) / "tsconfig.json").exists():
        if "JavaScript/TypeScript" in detected:
            primary = "TypeScript"
        elif "TypeScript" not in detected:
            detected.append("TypeScript")
            if primary is None:
                primary = "TypeScript"

    return {"primary": primary, "detected": detected}


def check_files(path: str) -> dict:
    p = Path(path)
    has_tests = any(
        (p / d).exists()
        for d in ["tests", "test", "__tests__", "spec", "src/tests", "src/__tests__"]
    ) or bool(list(p.glob("*test*")))

    return {
        "readme": (p / "README.md").exists() or (p / "readme.md").exists(),
        "tests": has_tests,
        "env": (p / ".env").exists(),
        "envExample": (p / ".env.example").exists(),
        "dockerfile": (p / "Dockerfile").exists(),
        "dockerCompose": (
            (p / "docker-compose.yml").exists()
            or (p / "docker-compose.yaml").exists()
            or (p / "compose.yml").exists()
        ),
    }


def check_cicd(path: str) -> dict:
    p = Path(path)
    return {
        "githubActions": (p / ".github" / "workflows").exists(),
        "circleci": (p / ".circleci").exists(),
        "travis": (p / ".travis.yml").exists(),
        "gitlabCi": (p / ".gitlab-ci.yml").exists(),
    }


def check_deployment(path: str) -> dict:
    p = Path(path)
    return {
        "fly": (p / "fly.toml").exists(),
        "vercel": (p / "vercel.json").exists(),
        "netlify": (p / "netlify.toml").exists(),
    }


def count_todos(path: str) -> tuple[int, int]:
    todo_count = 0
    fixme_count = 0

    for root, dirs, files in os.walk(path):
        dirs[:] = [d for d in dirs if d not in SKIP_WALK_DIRS]
        for fname in files:
            if Path(fname).suffix not in SOURCE_EXTENSIONS:
                continue
            fpath = os.path.join(root, fname)
            try:
                with open(fpath, "r", errors="ignore") as f:
                    for line in f:
                        if "TODO" in line:
                            todo_count += 1
                        if "FIXME" in line:
                            fixme_count += 1
            except (PermissionError, OSError):
                continue

    return todo_count, fixme_count


def get_description(path: str) -> str | None:
    pkg = Path(path) / "package.json"
    if pkg.exists():
        try:
            data = json.loads(pkg.read_text())
            desc = data.get("description")
            if desc:
                return desc
        except (json.JSONDecodeError, OSError):
            pass

    pyproject = Path(path) / "pyproject.toml"
    if pyproject.exists():
        try:
            text = pyproject.read_text()
            for line in text.splitlines():
                if line.strip().startswith("description"):
                    parts = line.split("=", 1)
                    if len(parts) == 2:
                        return parts[1].strip().strip('"').strip("'")
        except OSError:
            pass

    return None


def has_language_indicators(path: str) -> bool:
    """Check if a directory contains any language indicator files."""
    return any((Path(path) / f).exists() for f in LANGUAGE_INDICATORS)


def scan_project(abs_path: str) -> dict:
    name = os.path.basename(abs_path)
    git_info = get_git_info(abs_path)
    languages = detect_languages(abs_path)
    files = check_files(abs_path)
    cicd = check_cicd(abs_path)
    deployment = check_deployment(abs_path)
    todo_count, fixme_count = count_todos(abs_path)
    description = get_description(abs_path)

    return {
        "name": name,
        "path": abs_path,
        "pathHash": path_hash(abs_path),
        **git_info,
        "languages": languages,
        "files": files,
        "cicd": cicd,
        "deployment": deployment,
        "todoCount": todo_count,
        "fixmeCount": fixme_count,
        "description": description,
    }


def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: scan.py <dev_root> <exclude_csv>", file=sys.stderr)
        sys.exit(1)

    dev_root = os.path.expanduser(sys.argv[1])
    exclude_dirs = set(d.strip() for d in sys.argv[2].split(",") if d.strip())

    if not os.path.isdir(dev_root):
        print(json.dumps({"error": f"{dev_root} not found"}))
        sys.exit(1)

    projects = []
    for entry in sorted(Path(dev_root).iterdir()):
        if not entry.is_dir():
            continue
        if entry.name.startswith("."):
            continue
        if entry.name in exclude_dirs:
            continue
        # Skip non-project folders unless they have language indicators or are git repos
        abs_path = str(entry)
        if not (entry / ".git").exists() and not has_language_indicators(abs_path):
            continue
        projects.append(scan_project(abs_path))

    output = {
        "scannedAt": datetime.now(timezone.utc).isoformat(),
        "projectCount": len(projects),
        "projects": projects,
    }

    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()

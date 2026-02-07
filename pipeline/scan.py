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
            "isDirty": False,
            "untrackedCount": 0,
            "modifiedCount": 0,
            "stagedCount": 0,
            "ahead": 0,
            "behind": 0,
            "recentCommits": [],
            "branchCount": 0,
            "stashCount": 0,
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

    # Working tree status
    status_output = run_git(path, "status", "--porcelain")
    is_dirty = False
    untracked = 0
    modified = 0
    staged = 0
    if status_output:
        is_dirty = True
        for line in status_output.splitlines():
            if len(line) < 2:
                continue
            x, y = line[0], line[1]
            if x == "?" and y == "?":
                untracked += 1
            if y == "M" or x == "M":
                modified += 1
            if x in ("A", "M", "R", "D") and y != "?":
                staged += 1

    # Ahead/behind remote
    ahead_count = 0
    behind_count = 0
    if branch:
        ab_output = run_git(path, "rev-list", "--count", "--left-right", f"@{{upstream}}...HEAD")
        if ab_output:
            parts = ab_output.split()
            if len(parts) == 2:
                try:
                    behind_count = int(parts[0])
                    ahead_count = int(parts[1])
                except ValueError:
                    pass

    # Recent commits
    recent_commits: list[dict] = []
    log_output = run_git(path, "log", "-10", "--format=%H|%aI|%s")
    if log_output:
        for line in log_output.splitlines():
            parts = line.split("|", 2)
            if len(parts) == 3:
                recent_commits.append({
                    "hash": parts[0],
                    "date": parts[1],
                    "message": parts[2],
                })

    # Branch count
    branch_output = run_git(path, "branch", "--list")
    branch_count = len(branch_output.splitlines()) if branch_output else 0

    # Stash count
    stash_output = run_git(path, "stash", "list")
    stash_count = len(stash_output.splitlines()) if stash_output else 0

    return {
        "isRepo": True,
        "lastCommitDate": last_date,
        "lastCommitMessage": last_msg,
        "branch": branch,
        "remoteUrl": remote,
        "commitCount": commit_count,
        "daysInactive": days_inactive,
        "isDirty": is_dirty,
        "untrackedCount": untracked,
        "modifiedCount": modified,
        "stagedCount": staged,
        "ahead": ahead_count,
        "behind": behind_count,
        "recentCommits": recent_commits,
        "branchCount": branch_count,
        "stashCount": stash_count,
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


def count_todos(path: str) -> tuple[int, int, int]:
    """Walk source files, counting TODOs, FIXMEs, and total lines of code."""
    todo_count = 0
    fixme_count = 0
    loc_count = 0

    for root, dirs, files in os.walk(path):
        dirs[:] = [d for d in dirs if d not in SKIP_WALK_DIRS]
        for fname in files:
            if Path(fname).suffix not in SOURCE_EXTENSIONS:
                continue
            fpath = os.path.join(root, fname)
            try:
                with open(fpath, "r", errors="ignore") as f:
                    for line in f:
                        loc_count += 1
                        if "TODO" in line:
                            todo_count += 1
                        if "FIXME" in line:
                            fixme_count += 1
            except (PermissionError, OSError):
                continue

    return todo_count, fixme_count, loc_count


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


FRAMEWORK_MAP_JS: dict[str, str] = {
    "next": "nextjs",
    "react": "react",
    "vue": "vue",
    "@angular/core": "angular",
    "express": "express",
    "fastify": "fastify",
    "svelte": "svelte",
    "nuxt": "nuxt",
    "@remix-run/react": "remix",
    "gatsby": "gatsby",
}

FRAMEWORK_MAP_RUST: dict[str, str] = {
    "axum": "axum",
    "actix-web": "actix",
    "rocket": "rocket",
    "warp": "warp",
}

FRAMEWORK_MAP_PYTHON: list[tuple[str, str]] = [
    ("fastapi", "fastapi"),
    ("django", "django"),
    ("flask", "flask"),
    ("starlette", "starlette"),
]

SERVICE_DEPS: dict[str, str] = {
    "@supabase/supabase-js": "supabase",
    "posthog-js": "posthog",
    "posthog-node": "posthog",
    "stripe": "stripe",
    "firebase": "firebase",
    "firebase-admin": "firebase",
    "@aws-sdk": "aws",
    "@prisma/client": "prisma",
    "mongoose": "mongodb",
    "@sentry": "sentry",
}

ENV_KEY_PREFIXES: list[tuple[str, str]] = [
    ("SUPABASE_", "supabase"),
    ("POSTHOG_", "posthog"),
    ("NEXT_PUBLIC_POSTHOG", "posthog"),
    ("STRIPE_", "stripe"),
    ("FIREBASE_", "firebase"),
    ("AWS_", "aws"),
    ("DATABASE_URL", "database"),
    ("SENTRY_", "sentry"),
    ("OPENAI_", "openai"),
    ("ANTHROPIC_", "anthropic"),
]

LOCKFILE_MAP: list[tuple[str, str]] = [
    ("pnpm-lock.yaml", "pnpm"),
    ("package-lock.json", "npm"),
    ("yarn.lock", "yarn"),
    ("bun.lockb", "bun"),
    ("Cargo.lock", "cargo"),
    ("uv.lock", "uv"),
    ("poetry.lock", "poetry"),
    ("Pipfile.lock", "pipenv"),
]


def _read_json(path: str) -> dict | None:
    """Read a JSON file, returning None on any error."""
    try:
        return json.loads(Path(path).read_text())
    except (json.JSONDecodeError, OSError):
        return None


def detect_framework(path: str) -> str | None:
    """Detect the primary framework from dependency files."""
    p = Path(path)

    # Check package.json
    pkg = _read_json(str(p / "package.json"))
    if pkg:
        all_deps: dict = {}
        all_deps.update(pkg.get("dependencies", {}) or {})
        all_deps.update(pkg.get("devDependencies", {}) or {})
        for dep_name, framework in FRAMEWORK_MAP_JS.items():
            if dep_name in all_deps:
                return framework

    # Check Cargo.toml
    cargo = p / "Cargo.toml"
    if cargo.exists():
        try:
            text = cargo.read_text()
            for dep_name, framework in FRAMEWORK_MAP_RUST.items():
                # Match both [dependencies] table entries and inline
                if dep_name in text:
                    return framework
        except OSError:
            pass

    # Check pyproject.toml and requirements.txt
    pyproject = p / "pyproject.toml"
    requirements = p / "requirements.txt"
    py_text = ""
    if pyproject.exists():
        try:
            py_text += pyproject.read_text()
        except OSError:
            pass
    if requirements.exists():
        try:
            py_text += requirements.read_text()
        except OSError:
            pass
    if py_text:
        for dep_name, framework in FRAMEWORK_MAP_PYTHON:
            if dep_name in py_text:
                return framework

    return None


def detect_scripts(path: str) -> list[str]:
    """Extract script names from package.json."""
    pkg = _read_json(str(Path(path) / "package.json"))
    if pkg:
        scripts = pkg.get("scripts")
        if isinstance(scripts, dict):
            return list(scripts.keys())
    return []


def detect_services(path: str) -> list[str]:
    """Detect external services from deps and .env key prefixes."""
    p = Path(path)
    services: set[str] = set()

    # Check package.json dependencies
    pkg = _read_json(str(p / "package.json"))
    if pkg:
        all_deps: dict = {}
        all_deps.update(pkg.get("dependencies", {}) or {})
        all_deps.update(pkg.get("devDependencies", {}) or {})
        for dep_name in all_deps:
            for pattern, service in SERVICE_DEPS.items():
                if dep_name == pattern or dep_name.startswith(pattern + "/"):
                    services.add(service)

    # Check .env key prefixes (KEYS ONLY, never values)
    for env_file in [".env", ".env.local", ".env.development"]:
        env_path = p / env_file
        if env_path.exists():
            try:
                with open(str(env_path), "r", errors="ignore") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#"):
                            continue
                        key = line.split("=", 1)[0].strip()
                        for prefix, service in ENV_KEY_PREFIXES:
                            if key.startswith(prefix):
                                services.add(service)
            except (PermissionError, OSError):
                continue

    return sorted(services)


def detect_package_manager(path: str) -> str | None:
    """Detect package manager from lockfiles."""
    p = Path(path)
    for filename, manager in LOCKFILE_MAP:
        if (p / filename).exists():
            return manager
    return None


def detect_license(path: str) -> bool:
    """Check for LICENSE or LICENSE.md."""
    p = Path(path)
    return (p / "LICENSE").exists() or (p / "LICENSE.md").exists()


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
    todo_count, fixme_count, loc_estimate = count_todos(abs_path)
    description = get_description(abs_path)
    framework = detect_framework(abs_path)
    scripts = detect_scripts(abs_path)
    services = detect_services(abs_path)
    package_manager = detect_package_manager(abs_path)
    license_found = detect_license(abs_path)

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
        "framework": framework,
        "scripts": scripts,
        "services": services,
        "locEstimate": loc_estimate,
        "packageManager": package_manager,
        "license": license_found,
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

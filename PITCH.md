# Projects Dashboard

**Your daily starting point as a developer.**

---

## The Problem

If you're a developer with more than a handful of projects in `~/dev`, you already know the feeling: you sit down to work and can't remember what you were doing yesterday, which projects have uncommitted changes, and which ones you quietly abandoned six months ago.

The only way to get a picture is to open each folder, check git logs, scan for a README, and try to reconstruct context. That takes time you don't have, so you don't do it, and projects silently rot.

GitHub shows you repositories, but it doesn't know about your local experiments, your dirty working trees, or the project you've been meaning to push for three weeks. There's no tool that answers the two questions you actually have when you sit down to code:

1. **What was I working on?**
2. **What needs my attention?**

## What This Is

Projects Dashboard is a local web app that scans your development directory and becomes the first thing you open every morning.

It runs on your machine. No cloud, no accounts, no syncing. Open it in a browser and within seconds you know the state of everything you're building.

### What it does on every scan

1. **Discovers projects** in `~/dev` — anything with a git repo or language indicators
2. **Collects real-time facts** — git dirty state, ahead/behind remote, recent commits, branch, framework, external services, LOC, scripts, package manager
3. **Computes status** — active, paused, stale, or archived, based on commit recency
4. **Computes a health score** — 0 to 100, using gradient scoring across 11 signals (README, tests, CI, recency, remote, TODOs, deployment, linter, license, lockfile)
5. **Optionally asks an LLM** to generate purpose, tags, and recommendations — with hash-based skip so unchanged projects don't waste API calls
6. **Shows a compact dashboard** — sorted by last commit, filterable, keyboard-navigable, with pinned projects at the top and one-click launch into VS Code, Claude, Codex, or Terminal

### What makes it different from "just checking GitHub"

- It works with **local projects that aren't on GitHub** yet
- It shows **git dirty state** — you instantly see which projects have uncommitted work
- It answers **"what was I working on?"** — default sort by last commit, pinned projects, "Recently Active" view
- It catches **projects that need attention** — the Needs Attention filter surfaces low-health, stale, or dirty-and-abandoned projects
- It gives you **a health score** with gradient scoring — a gentle nudge toward better project hygiene
- It lets you **pin focus projects** to the top of the dashboard so you always see what matters
- **Keyboard shortcuts** let you navigate, launch tools, and pin projects without touching the mouse
- **Manual overrides** persist across every scan — your edits are never overwritten
- Everything is **local and private** — path sanitization means you can share screenshots without leaking your filesystem

## How It Improves Your Life

### Morning startup in 10 seconds

Open the dashboard. Your pinned projects are at the top. Everything else is sorted by last commit. You immediately see what you were working on, which projects have dirty working trees, and what needs doing. No terminal tabs, no `git status` in five different folders.

### Keyboard-driven workflow

Press `j`/`k` to navigate, `v` to open in VS Code, `c` to copy a Claude command, `p` to pin. The dashboard becomes a launcher — see everything, pick a project, start working.

### "Needs Attention" catches things before they rot

The filter surfaces projects with low health, no next action set, or uncommitted changes left too long. One glance tells you what's slipping.

### Pin what matters

Pin your active focus projects. They stay at the top across refreshes. Everything else falls into the sorted list below. No manual reordering — just pin and forget.

### One-click launch

Every project row has quick actions: VS Code, Claude CLI, Codex CLI, Terminal. Click or use keyboard shortcuts. The dashboard tracks what you open, so "last opened" becomes another signal for recency.

### Activity timeline

Open any project's drawer and see a full history: recent commits, when it was last scanned, when you last opened it, when overrides were changed. Context you'd otherwise lose.

### Health scores push consistency

A project with no README, no tests, and no remote scores poorly. The gradient scoring rewards incremental improvement — adding a linter config or a license nudges the score up.

### LLM enrichment fills in the gaps

Turn on LLM support and the dashboard generates purpose descriptions, suggested tags, and actionable recommendations. Unchanged projects are automatically skipped (hash-based detection), and LLM calls run in parallel for speed.

## The Workflow That Gets the Most Value

```
Every morning:
  1. Open dashboard — pinned projects at top, sorted by last commit
  2. Scan pinned projects — anything dirty? Any commits to push?
  3. Check "Needs Attention" — anything slipping?
  4. Press 'v' on a project → VS Code opens → start working

Weekly review (2 minutes):
  5. Hit Refresh
  6. Check Stale tab — archive or set next actions
  7. Glance at health scores — anything worth 10 minutes of cleanup?
```

### Who This Is For

- **Active developers** juggling 3-5 projects who need a launch point every morning
- **Prolific side-project builders** who start more things than they finish
- **Portfolio builders** assessing which projects are presentable
- **Open-source maintainers** who need a local overview across multiple repos

## Technical Details

- **Stack**: Next.js 16, React 19, TypeScript 5, Tailwind v4, shadcn/ui, Prisma 7, SQLite, Python 3
- **Runs locally**: no external server, no database service, just `npm run dev`
- **Scan pipeline**: Python scripts for filesystem scanning (15+ fields per project) and deterministic derivation
- **LLM support**: 5 pluggable providers — Claude CLI, OpenRouter, Ollama, MLX, Codex CLI
- **Pipeline optimizations**: hash-based LLM skip, parallel LLM calls (configurable concurrency), 90-day activity cleanup
- **Feature flags**: LLM enrichment, O-1 evidence export, path sanitization — all configurable
- **11 API routes** covering projects, overrides, metadata, pinning, activity, touch tracking, refresh (streaming + non-streaming), config, and evidence export
- **Keyboard shortcuts**: full navigation and action shortcuts (j/k/v/c/x/t/p/Enter/Esc)

## What "O-1 Evidence" Means

If you're building a portfolio for a visa application, performance review, or job search, the O-1 Evidence feature (behind a feature flag) lets you attach structured evidence and outcomes to each project, then export everything as a formatted markdown document. It turns your project history into a narrative.

## Status

All 21 implementation phases are complete. The dashboard has evolved from a portfolio tracker into a daily starting point — scanning projects, computing health with gradient scoring, tracking git dirty state and remote sync, supporting keyboard-driven navigation, project pinning, activity timelines, one-click tool launch, parallel LLM enrichment with change detection, and full documentation.

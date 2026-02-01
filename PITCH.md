# Projects Dashboard

**A bird's-eye view of everything you're building.**

---

## The Problem

If you're a developer with more than a handful of projects in `~/dev`, you already know the feeling: you can't remember what half of them do, which ones need attention, and which ones you quietly abandoned six months ago.

The only way to get a picture of your work is to open each folder, check git logs, scan for a README, and try to remember the context. That takes time you don't have, so you don't do it, and projects silently rot.

There's no tool that gives you a single view of all your local projects — their status, their health, what needs doing next. GitHub shows you repositories, but it doesn't know about your local experiments, your half-finished prototypes, or the project you've been meaning to add tests to for three months.

## What This Is

Projects Dashboard is a local web app that scans your development directory and shows you everything at a glance.

It runs on your machine. It reads your filesystem. No cloud, no accounts, no syncing. You open it in a browser and see the state of all your work in one place.

### What it does on every scan

1. **Discovers projects** in `~/dev` — anything with a git repo or language indicator files
2. **Collects facts** — last commit, languages, README, tests, CI/CD, TODOs, deployment config
3. **Computes status** — active, in-progress, stale, or archived, based on how recently you committed
4. **Computes a health score** — 0 to 100, based on whether a project has the basics: README, tests, CI, a remote, low TODO count
5. **Optionally asks an LLM** to generate a one-line purpose, tags, and recommendations
6. **Shows you a dashboard** — stats, cards, filters, search, and a detail drawer with editable fields

### What makes it different from "just checking GitHub"

- It works with **local projects that aren't on GitHub** yet
- It catches **projects you forgot about** — the Stalled view surfaces anything you haven't touched in 61+ days
- It gives you **a health score**, which is a gentle nudge toward better project hygiene
- It lets you **set next actions and goals** per project, turning the dashboard into a lightweight project backlog
- **Manual overrides** let you curate — mark something as "in-progress" even if git says it's stale, add notes, set a publish target
- Everything is **local and private** — path sanitization means you can share screenshots or export data without leaking your filesystem layout

## How It Improves Your Life

### Weekly review in 30 seconds

Open the dashboard, hit Refresh. You immediately see how many projects are active, how many are stale, and what your average health score is. No more opening 15 terminal tabs.

### The "Stalled" view catches things you forgot

Filter to stalled projects. These are things you haven't committed to in months. For each one, make a decision: set a next action, archive it intentionally, or delete it. This stops the slow accumulation of dead projects that clutter your workspace and your mental model.

### Health scores push you toward consistency

A project with no README, no tests, and no remote scores poorly. That number is a small, persistent reminder to spend 10 minutes bringing it up to baseline. Over time, your projects become more consistent and more presentable.

### "Next Actions" becomes your project backlog

In the detail drawer, set a Next Action for any project — "write tests," "deploy to production," "add auth." The Next Actions workflow view then becomes your personal kanban across all projects. Monday morning, open it, pick what to work on.

### Manual overrides let you be the authority

The scanner computes status and health automatically, but you know your projects better than an algorithm. Override the status, add notes, set goals. Your edits persist across every scan — they're never overwritten.

### LLM enrichment fills in the gaps

If you turn on LLM support, the dashboard will generate a one-line purpose, suggested tags, and actionable recommendations for each project. This is especially useful when you have 20+ projects and can't remember what half of them do.

## The Workflow That Gets the Most Value

```
Monday morning:
  1. Open dashboard, hit Refresh
  2. Check Stalled — anything here you care about?
     → Yes: set a next action
     → No: override status to "archived"
  3. Check Next Actions — pick what to work on today
  4. Work on your projects

After shipping something:
  5. Update metadata (goal, audience, publish target)
     so you remember the context next time
```

That's it. Five minutes a week for a clear picture of everything you're building.

## Who This Is For

- **Prolific side-project developers** who start more things than they finish and need a system to keep track
- **Portfolio builders** who want to know which projects are presentable and which need work
- **Developers doing a career review** who want to assess their body of work systematically
- **Open-source maintainers** juggling multiple repos who need a local overview that isn't tied to a single hosting platform

## Technical Details

- **Stack**: Next.js, TypeScript, Tailwind CSS, shadcn/ui, Prisma, SQLite, Python
- **Runs locally**: no external server, no database service, just `npm run dev`
- **Scan pipeline**: Python scripts for filesystem scanning and deterministic derivation
- **LLM support**: pluggable providers — Claude CLI, OpenRouter, Ollama, MLX, Codex CLI (agentic providers are gated)
- **Feature flags**: LLM enrichment and O-1 evidence export are off by default
- **OSS-ready**: path sanitization on by default, sample data included, no private information in the repo

## What "O-1 Evidence" Means

If you're building a portfolio for a visa application, performance review, or job search, the O-1 Evidence feature (behind a feature flag) lets you attach structured evidence and outcomes to each project, then export everything as a formatted markdown document. It turns your project history into a narrative.

## Status

All seven implementation phases are complete. The dashboard scans projects, computes health, supports LLM enrichment, has a full API, an interactive UI with workflow views, gated O-1 export, and documentation for open-source release.

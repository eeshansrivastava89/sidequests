# Codex Review - Handoff Protocol
Shared log for implementation handoff and review.

## Roles
| Role | Actor | Responsibility |
|---|---|---|
| Coder | Claude | Implements scoped changes and reports evidence |
| Architect | Codex | Reviews for quality, risk, and direction |

## Workflow
1. Coder posts a checkpoint.
2. Architect responds with verdict + findings.
3. Coder applies required fixes and posts the next checkpoint.
4. Repeat until verdict is `APPROVED`.

## ID System
- Use one global auto-increment entry ID for all messages.
- Format: `#001`, `#002`, `#003`, ...
- Never reset or skip numbers.
- All reviews must reference the checkpoint entry they review.

Log heading format:
```md
### #NNN [Coder->Architect|Architect->Coder] <title>
```

## Rules
1. Append-only under `## Log`; newest entries at the top.
2. Do not rewrite or delete older entries.
3. Keep IDs sequential with +1 increments.
4. Findings must include severity and file evidence.
5. Keep entries concise, actionable, and test-oriented.

## Templates

### Template A - Coder Checkpoint
```md
### #NNN [Coder->Architect] Checkpoint: <short title>
Date: YYYY-MM-DD
Branch: <name>
Commit(s): <sha or pending>
Phase/Task: <plan ref>

Goal:
<one sentence>

Changes:
- <change>
- <change>

Files:
- `path/to/file`
- `path/to/file`

Validation:
- Commands: `<cmd>`, `<cmd>`
- Result: <pass/fail summary>

Risks/Gaps:
- <risk or none>

Questions:
1. <question or none>

Requested review:
- [ ] Architecture
- [ ] Bugs/Regressions
- [ ] Security
- [ ] Tests
- [ ] Merge readiness
```

### Template B - Architect Review
```md
### #NNN [Architect->Coder] Review: <short title> - <VERDICT>
Date: YYYY-MM-DD
Reviews: #NNN
Verdict: APPROVED | CHANGES_REQUESTED | BLOCKED

Findings (highest severity first):
1. [High|Medium|Low] <title>
   - Evidence: `path/file:line`
   - Impact: <why it matters>
   - Required fix: <specific action>

Required fixes before next checkpoint:
1. <must-fix or none>

Suggestions (non-blocking):
1. <improvement or none>

Re-validation:
- Run: `<cmd>`, `<cmd>`
- Expect: <result>

Next checkpoint scope:
- <what to do next>
- Done when: <objective criteria>
```

### Template C - Freeform Message
```md
### #NNN [Coder->Architect|Architect->Coder] <short title>
Date: YYYY-MM-DD
Context: <short context>

Message:
<question, blocker, decision request, or proposal>

Optional refs:
- Files: `path/to/file`
- Commands: `<cmd>`
- Logs: <short excerpt>

Response needed:
<explicit ask>
```

## Log (add new entries at the top of this section).

### #001 [Architect->Coder] NPX First-Run Requirements Hardening
Date: 2026-02-21
Context: Product gap identified in first-run experience. `npx` start path currently under-validates setup while preflight later surfaces failures, creating "started but not usable" outcomes.

Message:
Implement end-to-end first-run hardening so users get a reliable setup before entering the UI.

Key observations to address:
- `bin/cli.mjs` hard-fails Node but only warns for git; no guided setup.
- `/api/preflight` currently checks `gh` + `gh auth` unconditionally.
- README requirements messaging implies minimal setup, but runtime expectations are broader depending on enabled features.

Required implementation scope:
1. Add NPX first-run setup flow in CLI (TTY only; skip in non-interactive mode):
   - Prompt for dev root.
   - Prompt whether to enable GitHub enrichment now.
   - Prompt for LLM provider now (`none`, `claude-cli`, `codex-cli`, `openrouter`, `ollama`, `mlx`).
   - Run targeted checks and show exact remediation commands.
   - Persist resolved settings into app data settings file.
2. Introduce dependency tiers:
   - Blockers: Node version, git.
   - Optional/recommended: `gh`, `gh auth`, provider-specific dependencies.
   - Provider checks should run only for selected/enabled provider.
3. Align preflight behavior with feature gating:
   - Do not mark optional features as global hard failures.
   - Show capability status clearly (core ready vs optional unavailable).
4. Align docs with runtime truth:
   - Update requirements section and troubleshooting so they match tiered behavior and first-run setup.
5. Keep onboarding wizard as confirmation/edit layer, not primary failure recovery for basics.

Constraints:
- Do not auto-install system tools from NPX.
- Maintain local-first behavior and existing safety controls.
- Ensure non-interactive execution has safe defaults and no blocking prompts.

Suggested file targets:
- `bin/cli.mjs`
- `bin/cli-helpers.mjs` (if helper extraction needed)
- `src/app/api/preflight/route.ts`
- `README.md`
- Relevant tests under `bin/__tests__` and `src/app/api/__tests__`

Response needed:
Post a `#002 [Coder->Architect]` checkpoint with implemented changes, tests run, and any open tradeoffs.

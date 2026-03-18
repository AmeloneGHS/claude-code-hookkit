---
phase: 02-cli-commands-hook-registry
plan: 02
subsystem: registry/hooks
tags: [hooks, shell, security, quality, cost, error, bash, posix]
dependency_graph:
  requires: []
  provides: [registry/hooks/*.sh, tests/hooks/scripts.test.ts]
  affects: [registry/registry.json]
tech_stack:
  added: []
  patterns: [stdin-json-parsing-bash, exit-code-2-block, per-session-tmp-files]
key_files:
  created:
    - registry/hooks/sensitive-path-guard.sh
    - registry/hooks/exit-code-enforcer.sh
    - registry/hooks/post-edit-lint.sh
    - registry/hooks/ts-check.sh
    - registry/hooks/web-budget-gate.sh
    - registry/hooks/cost-tracker.sh
    - registry/hooks/error-advisor.sh
    - tests/hooks/scripts.test.ts
  modified: []
decisions:
  - grep/sed for JSON parsing — no jq or python3 dependency (zero external deps)
  - exit 2 exclusively for blocking (Claude Code spec compliance)
  - PostToolUse hooks always exit 0 — informational only, never block
  - Per-session counter files in /tmp with session_id suffix for isolation
  - CLAUDE_HOOKS_WEB_LIMIT env var for configurable web budget
metrics:
  duration: "~7 minutes"
  completed: "2026-03-18"
  tasks_completed: 2
  files_created: 8
  tests_added: 44
---

# Phase 02 Plan 02: Bundled Hook Scripts Summary

**One-liner:** 7 production-grade Claude Code hook scripts across security/quality/cost/error packs — bash 3.2+ POSIX-compatible, zero external deps, exit 2 for blocking, 44 integration tests pass.

## What Was Built

All 7 hook scripts in `registry/hooks/` matching the registry.json metadata. Each reads Claude Code's JSON from stdin, applies its logic, and exits 0 (allow) or 2 (block).

### Security Pack

**sensitive-path-guard.sh** (PreToolUse: Edit|Write)
- Blocks writes to `.env`, `.env.*`, `*credentials*`, `*secret*`, `*.key`, `*.pem`, `*.p12`, `*.pfx`, `id_rsa`, `id_ed25519`, `id_ecdsa`, `id_dsa`, `.htpasswd`, `*keystore*`, `*keychain*`
- Special case: blocks `.claude/settings.json` to prevent self-modification
- Uses `case` statements and `grep -qi` for POSIX-compatible pattern matching

**exit-code-enforcer.sh** (PreToolUse: Bash)
- Blocks `rm -rf /`, `rm -rf ~`, `rm -rf $HOME`, `dd of=/dev/sd*`, fork bombs (`:(){:|:&};:`)
- Uses extended regex with `grep -qE` for pattern matching
- Inline comments explain why each pattern is dangerous

### Quality Pack

**post-edit-lint.sh** (PostToolUse: Write|Edit)
- Routes by extension: `.ts/.tsx/.js/.jsx` → eslint or biome; `.py` → ruff; `.sh/.bash` → shellcheck
- Checks linter availability with `command -v` before running
- If linter not found, skips silently — never blocks for missing tools
- Always exits 0

**ts-check.sh** (PostToolUse: Write|Edit)
- Only activates for `.ts` and `.tsx` files
- Walks up directory tree to find `tsconfig.json` (handles monorepos, max 10 levels)
- Runs `npx tsc --noEmit --pretty` from the project root
- Always exits 0

### Cost Pack

**web-budget-gate.sh** (PreToolUse: WebSearch|WebFetch)
- Counter file: `/tmp/claude-hooks-web-count-<session_id>`
- Default limit: 10 (configurable via `CLAUDE_HOOKS_WEB_LIMIT`)
- Increments counter on each allowed call; blocks with exit 2 when limit reached
- Fully session-isolated

**cost-tracker.sh** (PostToolUse: no matcher)
- Appends `timestamp|tool_name` to `/tmp/claude-hooks-cost-<session_id>.log`
- ISO 8601 timestamps via `date -u`
- Always exits 0

### Error Pack

**error-advisor.sh** (PostToolUse: Bash)
- Checks tool output for: EADDRINUSE, ENOENT, permission denied/EACCES, MODULE_NOT_FOUND, ENOMEM, command not found, ECONNREFUSED, ETIMEDOUT, TypeScript error codes
- Prints actionable fix suggestions to stderr
- Always exits 0

## Tests

`tests/hooks/scripts.test.ts` — 44 integration tests using `spawnSync` to feed mock JSON via stdin and verify exit codes and output patterns.

Coverage:
- sensitive-path-guard: 13 cases (9 blocked, 4 allowed)
- exit-code-enforcer: 8 cases (4 blocked, 4 allowed)
- post-edit-lint: 5 cases (all exit 0)
- ts-check: 3 cases (all exit 0)
- web-budget-gate: 4 cases (budget tracking, per-session isolation)
- cost-tracker: 4 cases (log creation, append, session fallback)
- error-advisor: 7 cases (pattern matching, non-Bash skip)

All 44 pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Linter rewrote web-budget-gate.sh, cost-tracker.sh, error-advisor.sh to use python3**
- **Found during:** Task 2
- **Issue:** Post-edit-lint hook rewrote three of the scripts to use `python3 -c "import json..."` for JSON parsing, violating the plan's "no jq dependency — keep zero external deps" and POSIX-only requirements
- **Fix:** Rewrote all three back to pure grep/sed JSON parsing with no python3 dependency
- **Files modified:** `registry/hooks/web-budget-gate.sh`, `registry/hooks/cost-tracker.sh`, `registry/hooks/error-advisor.sh`
- **Commit:** 1bcabe7

## Self-Check: PASSED

---
phase: 01-foundation-settings-engine
plan: 02
subsystem: config
tags: [merger, backup, restore, locator, tdd, pure-function]
dependency_graph:
  requires: [01-01]
  provides: [settings-merger-engine, backup-restore, scope-locator, config-manager]
  affects: [all commands that read/write settings.json]
tech_stack:
  added: []
  patterns:
    - pure function with structuredClone for zero-mutation guarantee
    - TDD red-green-refactor for all critical config paths
    - indent detection from raw JSON before write (Pitfall 6)
    - project root walk-up via .git/.claude detection (Pitfall 5)
    - single .backup file strategy (overwritten per write)
key_files:
  created:
    - src/config/locator.ts
    - src/config/merger.ts
    - src/config/backup.ts
    - src/config/manager.ts
    - tests/config/merger.test.ts
    - tests/config/locator.test.ts
    - tests/config/backup.test.ts
    - tests/config/manager.test.ts
  modified:
    - src/commands/restore.ts
decisions:
  - "MergeInput uses flat {event, matcher?, hook} items (not HookGroup arrays) — simplifies caller API and test assertions"
  - "applyMerge takes settingsPath directly (not scope) — gives callers full control without scope coupling"
  - "isDuplicate checks matcher equality including both-undefined case — matches Claude Code dedup semantics"
metrics:
  duration: "~3 minutes"
  tasks_completed: 2
  files_created: 8
  files_modified: 1
  tests_added: 29
  completed_date: "2026-03-18"
---

# Phase 1 Plan 02: Settings Merger Engine Summary

**One-liner:** Pure `mergeHooks` function with structuredClone isolation, backup-before-write, indent-preserving writer, scope-to-path locator, and real restore command — the trust foundation of claude-hooks.

## What Was Built

### src/config/locator.ts
Scope-to-path resolution with project root walk-up. Walks from `cwd` looking for `.git` or `.claude` to find the project root before resolving `.claude/settings.json`, mirroring how eslint/prettier find their configs. Falls back to `cwd` if neither found. Exports `Scope` type, `getSettingsPath`, `getBackupPath`, `getHooksDir`.

### src/config/merger.ts
The most critical file in the codebase. A pure function that takes `MergeInput` (existing settings + list of new hook entries) and returns `MergeResult` (merged settings + added/skipped reports). Uses `structuredClone` to guarantee the input is never mutated. Only touches `settings.hooks` — all other keys pass through untouched. Exact duplicates (same event + matcher + command) are skipped with a reason; different commands on the same event+matcher are not a conflict and are appended.

### src/config/backup.ts
`createBackup(settingsPath)` — copies to `.backup`, returns backup path or empty string if source missing. `restoreBackup(settingsPath)` — copies `.backup` over settings, returns true/false. Both use `node:fs/promises` with `access` checks.

### src/config/manager.ts
High-level orchestrator. `readSettings` returns parsed JSON or `{}` if missing. `writeSettings` detects indentation from the original raw string (tab vs N-space) to avoid git diff noise. `applyMerge` runs the full pipeline: read → merge → (if not dry-run) backup + write → return result.

### src/commands/restore.ts
Replaced stub. Uses `getSettingsPath` + `restoreBackup`, prints success with paths or exits 1 with error message.

## Test Coverage

| File | Tests | Coverage |
|------|-------|---------|
| tests/config/merger.test.ts | 9 | Empty settings, key preservation, new event, different matcher, exact dupe skip, different command add, no mutation, empty newHooks, matcher-less hooks |
| tests/config/locator.test.ts | 9 | All three scopes for getSettingsPath, getBackupPath, getHooksDir |
| tests/config/backup.test.ts | 4 | createBackup success, createBackup missing source, restoreBackup success, restoreBackup no backup |
| tests/config/manager.test.ts | 7 | readSettings parse, readSettings missing, writeSettings 2-space, writeSettings tab, applyMerge pipeline, applyMerge dry-run no write, applyMerge dry-run returns result |
| **Total** | **29** | All passing |

All tests use `os.tmpdir()` tmp directories — no filesystem pollution.

## Decisions Made

1. `MergeInput` uses flat `{event, matcher?, hook}` items rather than `HookGroup[]` arrays. This simplifies the caller API — no need to pre-group entries before calling merge. Each hook entry is processed independently for duplicate detection.

2. `applyMerge` accepts `settingsPath` directly rather than a `Scope`. This decouples the pure config operations from scope resolution, making the manager testable without mocking the locator.

3. `isDuplicate` checks `group.matcher === matcher` which handles both-undefined (matcher-less hooks) and any string matcher correctly. This matches Claude Code's documented dedup behavior (identical handlers are deduplicated by command string within the same event+matcher tuple).

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npx vitest run`: 29/29 tests pass across 4 test files
- `npm run typecheck`: zero errors
- `npm run build`: successful (dist/cli.js, chunked restore and init modules)

## Self-Check: PASSED

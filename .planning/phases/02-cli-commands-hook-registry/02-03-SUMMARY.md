---
phase: 02-cli-commands-hook-registry
plan: "03"
subsystem: cli
tags: [doctor, pack-install, help, tdd, typescript]
dependency_graph:
  requires: ["02-01", "02-02"]
  provides: ["doctor-command", "pack-installation", "help-finalization"]
  affects: ["src/cli.ts", "src/commands/add.ts", "src/commands/doctor.ts"]
tech_stack:
  added: []
  patterns: ["TDD red-green", "pure-function testability via explicit path injection", "Commander.js lazy imports"]
key_files:
  created:
    - src/commands/doctor.ts
    - tests/commands/doctor.test.ts
    - tests/commands/add-pack.test.ts
  modified:
    - src/commands/add.ts
    - src/cli.ts
decisions:
  - "Used ClaudeSettings type + HookGroup import directly in doctor.ts to avoid type conflicts with readSettings return type"
  - "doctor reports WARN (not FAIL) when settings file missing — user may not have initialized yet"
  - "_addPackAt iterates pack.hooks calling _addAt for each, relying on applyMerge dedup for skip-already-installed behavior"
  - "addCommand now checks getPack before getHook, then errors with suggestion if neither"
metrics:
  duration: "~15 minutes"
  completed: "2026-03-18"
  tasks_completed: 2
  files_created: 3
  files_modified: 2
  tests_added: 18
---

# Phase 2 Plan 03: Doctor Command, Pack Installation, Help Finalization Summary

Doctor command with colored health checks, pack installation via `add <pack>`, and --help examples finalized on all 6 commands.

## What Was Built

### Doctor Command (`src/commands/doctor.ts`)

- `_doctorAt({ settingsPath, hooksDir })` — testable core that runs 5 checks and returns `DoctorResult`
- Check 1: settings file exists (WARN if missing, FAIL if malformed JSON)
- Check 2: hooks directory exists (FAIL if missing)
- Check 3+4: each command in settings.hooks is validated — file exists (FAIL if not) and is executable (FAIL if not)
- Check 5: conflict detection — same event+matcher tuple with different commands triggers WARN (SET-05)
- `doctorCommand({ scope })` public entry resolves paths from scope and calls `process.exit(result.exitCode)`
- Output: colored `[PASS]` (green), `[FAIL]` (red), `[WARN]` (yellow) with summary count line
- Exit code 1 if any FAIL, 0 if only PASS/WARN

### Pack Installation (`src/commands/add.ts`)

- Added `_addPackAt({ settingsPath, hooksDir, sourceHooksDir?, packName, dryRun? })`
- Iterates `pack.hooks`, calls `_addAt` for each hook — inherits dedup behavior from `applyMerge`
- `addCommand` now: checks `getPack` first, then `getHook`, then errors with helpful message
- Error message: `Unknown hook or pack: "x". Run "claude-hooks list" to see available options.`

### Help Finalization (`src/cli.ts`)

- `add` command --help updated to include `security-pack` example
- `doctor` command registered with `--scope` option and --help examples
- All 6 commands now visible in `--help`: init, restore, add, remove, list, doctor

## Test Coverage

- `tests/commands/doctor.test.ts` — 11 tests covering all check states (clean, missing file, malformed JSON, non-executable, conflicts, no-hooks)
- `tests/commands/add-pack.test.ts` — 7 tests covering pack install, settings entries, dedup skip, unknown pack, dry-run

## Verification Results

```
Test Files  12 passed (12)
     Tests  134 passed (134)
```

Build: clean (tsup, no errors)
Typecheck: clean (tsc --noEmit, no errors)
Smoke: `node dist/cli.js doctor --help` shows usage + examples
       `node dist/cli.js --help` shows all 6 commands

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Type annotation conflict in doctor.ts**
- **Found during:** Task 1 (typecheck)
- **Issue:** Local type annotation `{ hooks?: Record<...> } | null` for the `settings` variable was incompatible with `ClaudeSettings` returned by `readSettings`. TypeScript reported 7 type errors.
- **Fix:** Changed `settings` to `ClaudeSettings | undefined`, used `settings.hooks as Record<string, HookGroup[]> | undefined` with the imported `HookGroup` type. Extracted `extractCommands()` helper for clean iteration.
- **Files modified:** `src/commands/doctor.ts`
- **Commit:** 6feaed3

## Self-Check: PASSED

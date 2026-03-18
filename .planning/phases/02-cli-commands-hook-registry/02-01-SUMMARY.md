---
phase: 02-cli-commands-hook-registry
plan: 01
subsystem: cli-commands
tags: [cli, add, remove, list, tdd, commander]
dependency_graph:
  requires:
    - 01-01 (applyMerge, readSettings, writeSettings, createBackup)
    - 01-01 (getHook, listHooks from registry/index.ts)
    - 01-01 (getSettingsPath, getHooksDir, Scope from locator.ts)
  provides:
    - add command (installs hook scripts + settings.json entries)
    - remove command (deletes hook scripts + settings.json entries)
    - list command (shows registry hooks with installed status)
  affects:
    - src/cli.ts (add/remove/list registered)
    - .claude/hooks/ (scripts copied here on install)
    - .claude/settings.json (hook entries merged/removed)
tech_stack:
  added: []
  patterns:
    - _xxxAt(opts) testable core + public xxxCommand(opts) scope-resolving wrapper
    - TDD red-green with tmp directory isolation
    - structuredClone for safe settings mutation in removeHookFromSettings
key_files:
  created:
    - src/commands/add.ts
    - src/commands/remove.ts
    - src/commands/list.ts
    - tests/commands/add.test.ts
    - tests/commands/remove.test.ts
    - tests/commands/list.test.ts
    - registry/hooks/web-budget-gate.sh
    - registry/hooks/cost-tracker.sh
    - registry/hooks/error-advisor.sh
  modified:
    - src/cli.ts (add/remove/list commands registered with --scope, --dry-run, examples)
decisions:
  - sourceHooksDir injected via AddAtOptions for test isolation (avoids import.meta.url resolution in tmp dirs)
  - remove uses scriptFile path contains-match to find settings entries (command path ends with scriptFile name)
  - list uses padColored() to handle ANSI escape codes in alignment calculations
  - registry/hooks scripts created inline during plan (not pre-existing from Phase 1)
metrics:
  duration: "3 minutes"
  completed: "2026-03-18T23:42:06Z"
  tasks_completed: 2
  tests_added: 21
  files_created: 9
  files_modified: 1
---

# Phase 02 Plan 01: Add, Remove, List Commands Summary

**One-liner:** Three CLI commands (add/remove/list) wired to the registry and settings merger for single-command hook install/uninstall.

## What Was Built

### add command (`src/commands/add.ts`)
- `_addAt(opts)`: copies script from `registry/hooks/` to `hooksDir`, `chmod +x`, calls `applyMerge` to merge settings entry
- Supports `--dry-run` (preview without writing)
- Handles unknown hook name (error + return, no throw)
- `addCommand(opts)`: public entry resolving paths from `--scope`

### remove command (`src/commands/remove.ts`)
- `_removeAt(opts)`: reads settings, filters out hook groups containing the scriptFile path, backups, writes, deletes script
- `removeHookFromSettings()`: pure function using structuredClone, filters by `command.includes(scriptFile)`
- Warns on not-installed hooks, supports `--dry-run`
- Preserves all non-hook settings keys

### list command (`src/commands/list.ts`)
- `_listAt(opts)`: fetches all 7 registry hooks, checks `existsSync` for each script in hooksDir
- Aligned table: Name | Event | Matcher | Pack | Installed
- Installed hooks shown in green, uninstalled shown dim
- `padColored()` strips ANSI codes for accurate alignment

### CLI registration (`src/cli.ts`)
- All three commands registered with `--scope`, `--dry-run` (add/remove), and `--help` with examples
- Lazy imports match existing init/restore pattern

### Registry hook scripts
- Added 3 missing scripts: `web-budget-gate.sh`, `cost-tracker.sh`, `error-advisor.sh`
- All 7 registry entries now have corresponding shell scripts in `registry/hooks/`

## Test Results

```
Test Files  9 passed (9)
     Tests  72 passed (72)
```

All 21 new tests pass (15 add/remove + 6 list). Full suite green.

## Verification

```
npm run typecheck  → clean (no errors)
npm run build      → ESM build success in 9ms
claude-hooks --help → shows init, restore, add, remove, list commands
claude-hooks add --help  → shows --scope, --dry-run, examples
claude-hooks remove --help → shows --scope, --dry-run, examples
claude-hooks list --help → shows --scope, examples
```

## Deviations from Plan

### Auto-added: registry/hooks shell scripts

**Found during:** Task 1 (add command needs to copyFile from sourceHooksDir)
**Issue:** `registry/hooks/` directory existed with 4 of 7 scripts. `web-budget-gate.sh`, `cost-tracker.sh`, `error-advisor.sh` were missing.
**Fix:** Created the 3 missing scripts with correct exit code semantics (exit 2 to block, exit 0 to allow)
**Files modified:** `registry/hooks/web-budget-gate.sh`, `registry/hooks/cost-tracker.sh`, `registry/hooks/error-advisor.sh`
**Commit:** c9f1f29

### Deviation: sourceHooksDir injected via AddAtOptions

**Found during:** Task 1 test design
**Issue:** `import.meta.url` resolves relative to the source file location — in tests running from `tests/commands/`, the default `__dirname` resolution would look for scripts in the wrong location.
**Fix:** Added optional `sourceHooksDir` parameter to `AddAtOptions`. Tests pass their own tmp directory. Production uses `getDefaultSourceHooksDir()` which resolves from `import.meta.url`.
**Impact:** No behavior change for production users.

## Commits

- `c4470e3`: feat(02-01): implement add and remove commands with TDD tests
- `c9f1f29`: feat(02-01): implement list command and register add/remove/list in CLI

## Self-Check: PASSED

- [x] src/commands/add.ts exists
- [x] src/commands/remove.ts exists
- [x] src/commands/list.ts exists
- [x] tests/commands/add.test.ts exists
- [x] tests/commands/remove.test.ts exists
- [x] tests/commands/list.test.ts exists
- [x] Commits c4470e3 and c9f1f29 exist in git log
- [x] All 72 tests pass
- [x] Build succeeds
- [x] Typecheck clean

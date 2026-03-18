---
phase: 01-foundation-settings-engine
plan: "03"
subsystem: registry-and-init
tags: [registry, init, tdd, cli]
dependency_graph:
  requires: ["01-01", "01-02"]
  provides: ["registry-manifest", "registry-lookup", "init-command"]
  affects: ["02-add-remove-command"]
tech_stack:
  added: []
  patterns: ["import.meta.url path resolution", "createRequire for JSON", "testable internal _initAt function"]
key_files:
  created:
    - registry/registry.json
    - src/registry/index.ts
    - tests/registry/index.test.ts
    - tests/commands/init.test.ts
  modified:
    - src/commands/init.ts
decisions:
  - "_initAt exported for testability: init command exposes internal _initAt(opts: InitAtOptions) so tests inject tmp paths without touching real filesystem"
  - "loadRegistry uses createRequire: ESM createRequire used to load JSON rather than dynamic import() to get synchronous load with caching"
  - "empty hooks no-op: hooks:{} (empty object) is treated as already-seeded — hooksDir still created but settings not re-written"
metrics:
  duration: "~15 minutes"
  completed: "2026-03-18"
  tasks_completed: 2
  files_changed: 5
key_decisions:
  - "_initAt exported for testability: init command exposes internal _initAt(opts: InitAtOptions) so tests inject tmp paths without touching real filesystem"
  - "loadRegistry uses createRequire: ESM createRequire used to load JSON rather than dynamic import() to get synchronous load with caching"
  - "empty hooks no-op: hooks:{} is treated as already-seeded — hooksDir still created but settings not re-written"
---

# Phase 1 Plan 3: Registry Data Model and Init Command Summary

Registry manifest loaded and validated, registry lookup functions complete, init command fully functional with TDD coverage.

## What Was Built

**registry/registry.json** — Static manifest with 7 hook definitions across 4 packs: security-pack (sensitive-path-guard, exit-code-enforcer), quality-pack (post-edit-lint, ts-check), cost-pack (web-budget-gate, cost-tracker), error-pack (error-advisor). Each entry has name, description, event, optional matcher, pack membership, and scriptFile.

**src/registry/index.ts** — Registry lookup module. Uses `createRequire(import.meta.url)` for synchronous JSON loading with module-level cache. Validates with Zod `registrySchema` on first load, throws on malformed data. Exports: `loadRegistry`, `getHook`, `getPack`, `listHooks`, `listPacks`.

**src/commands/init.ts** — Full init command replacing stub. Exports `initCommand` (public, resolves paths from scope) and `_initAt` (internal, accepts explicit paths for testability). Flow: read existing settings → check already-initialized → dry-run preview or mkdir + backup + write `{hooks: {}}` + print summary.

## Test Results

```
Test Files  6 passed (6)
     Tests  51 passed (51)
```

Breakdown:
- `tests/registry/index.test.ts` — 13 tests: loadRegistry, getHook, getPack, listHooks, listPacks, consistency
- `tests/commands/init.test.ts` — 9 integration tests using tmp directories

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed incorrect `dirname` import from `node:fs`**
- **Found during:** TypeScript typecheck
- **Issue:** `dirname` is exported from `node:path`, not `node:fs`. Import line had `import { dirname, existsSync } from 'node:fs'`
- **Fix:** Removed `dirname` from `node:fs` import; it was already imported as `pathDirname` from `node:path`
- **Files modified:** `src/commands/init.ts`
- **Commit:** b6c9156

**2. [Rule 1 - Bug] Fixed test spy read-after-restore ordering**
- **Found during:** Task 2 test run
- **Issue:** Test read `consoleSpy.mock.calls` after `mockRestore()` — vitest clears mock state on restore
- **Fix:** Wrapped spy assertions in try/finally, reading calls before restore
- **Files modified:** `tests/commands/init.test.ts`
- **Commit:** b6c9156

## Smoke Test Evidence

```bash
$ cd /tmp/claude-hooks-smoke
$ node dist/cli.js init --dry-run
[DRY RUN] Would create directory: /private/tmp/claude-hooks-smoke/.claude/hooks
[DRY RUN] Would seed settings.json at: /private/tmp/claude-hooks-smoke/.claude/settings.json
[DRY RUN] Would add empty hooks structure

$ node dist/cli.js init
Created /private/tmp/claude-hooks-smoke/.claude/hooks
Seeded /private/tmp/claude-hooks-smoke/.claude/settings.json with hooks configuration

$ cat .claude/settings.json
{ "hooks": {} }

$ node dist/cli.js init  (re-run on empty hooks - no output, no-op)

$ # With non-empty hooks:
$ node dist/cli.js init
Already initialized at /private/tmp/claude-hooks-smoke2/.claude/settings.json
```

## Self-Check: PASSED

Files created:
- registry/registry.json: FOUND
- src/registry/index.ts: FOUND
- tests/registry/index.test.ts: FOUND
- tests/commands/init.test.ts: FOUND
- src/commands/init.ts: FOUND (modified)

Commits:
- aca8867: FOUND (test RED + registry GREEN, committed together)
- b6c9156: FOUND (init command implementation)

---
phase: 01-foundation-settings-engine
plan: "01"
subsystem: scaffold
tags: [typescript, cli, types, zod, commander, tsup, vitest]

dependency_graph:
  requires: []
  provides:
    - TypeScript build pipeline (tsup -> dist/cli.js)
    - Commander.js CLI entry point with init + restore command stubs
    - ClaudeSettings, HookGroup, HookEntry, MergeResult types
    - HookEvent union (25 events) + Zod schemas
    - HookDefinition, HookPack, Registry interfaces + Zod schemas
    - Colored logger utility (picocolors)
  affects:
    - All subsequent Phase 1 plans (build on these types)
    - Phase 2 add/remove commands (extend CLI skeleton)

tech_stack:
  added:
    - commander@14.x — CLI argument parsing, subcommands, auto-help
    - picocolors@1.1.1 — Terminal colors (7KB, CI-aware)
    - zod@3.24.x — Schema validation with TS type inference
    - typescript@5.7.x — Strict mode, ES2022 target
    - tsup@8.5.1 — ESM bundler with shebang insertion
    - vitest@2.1.x — ESM-native test framework
  patterns:
    - ESM-first (type module, ESNext modules, bundler resolution)
    - Lazy command imports in CLI (import() per action) for fast startup
    - Zod passthrough() on settings schema to preserve unknown keys
    - Pure function merger pattern (no I/O, structuredClone)

key_files:
  created:
    - package.json — ESM package, bin field, scripts, deps
    - tsconfig.json — strict, ES2022, bundler moduleResolution
    - tsup.config.ts — ESM build, shebang banner, node18 target
    - vitest.config.ts — test discovery config
    - .gitignore — node_modules, dist, *.backup, .DS_Store
    - src/cli.ts — Commander.js entry, init + restore commands
    - src/types/settings.ts — ClaudeSettings, HookGroup, HookEntry, MergeResult
    - src/types/hooks.ts — HookEvent union, hookEventSchema, hookGroupSchema, claudeSettingsSchema
    - src/registry/types.ts — HookDefinition, HookPack, Registry + Zod schemas
    - src/utils/logger.ts — log.info/success/warn/error/dim/dryRun
    - src/commands/init.ts — initCommand stub
    - src/commands/restore.ts — restoreCommand stub
    - package-lock.json — dependency lock
  modified: []

decisions:
  - Used Zod 3.x (not 4.x) — npm resolved to 3.24.x which is the stable widely-deployed version; avoids Zod 4 migration friction
  - Hardcoded version '0.1.0' in cli.ts instead of importing from package.json — avoids resolveJsonModule complexity with ESM bundler resolution; version is easily updated
  - Lazy imports in CLI action handlers — keeps startup fast, only loads command module when invoked

metrics:
  duration_seconds: 86
  completed: "2026-03-18"
  tasks_completed: 2
  tasks_total: 2
  files_created: 13
  files_modified: 0
---

# Phase 1 Plan 01: TypeScript Scaffold, CLI Skeleton, Types and Schemas

**One-liner:** ESM TypeScript project with Commander.js CLI, 25-event Zod schemas, and typed settings.json model using tsup/vitest build pipeline.

## What Was Built

Task 1 created the full project scaffold: package.json with ESM configuration and bin field, tsconfig.json with strict mode and bundler module resolution, tsup.config.ts with shebang banner insertion, vitest.config.ts for test discovery, and .gitignore. `npm install` resolved 88 packages including commander, picocolors, zod, tsup, typescript, and vitest.

Task 2 created all TypeScript types, Zod schemas, the logger utility, CLI entry point, and command stubs. The CLI skeleton supports `--help`, `--version`, `init --help` (showing `--scope` and `--dry-run`), and `restore --help`. All source compiles under strict mode with zero errors.

## Verification Results

| Check | Result |
|-------|--------|
| `npm run build` | PASS — ESM bundle emitted to dist/cli.js |
| `npm run typecheck` | PASS — zero TypeScript errors under strict mode |
| `node dist/cli.js --help` | PASS — shows init and restore commands |
| `node dist/cli.js init --help` | PASS — shows --scope and --dry-run options |
| `node dist/cli.js --version` | PASS — prints 0.1.0 |

## Key Exports

| File | Exports |
|------|---------|
| `src/types/settings.ts` | `ClaudeSettings`, `HookGroup`, `HookEntry`, `MergeResult` |
| `src/types/hooks.ts` | `HookEvent`, `hookEventSchema`, `hookEntrySchema`, `hookGroupSchema`, `claudeSettingsSchema` |
| `src/registry/types.ts` | `HookDefinition`, `HookPack`, `Registry`, `hookDefinitionSchema`, `hookPackSchema`, `registrySchema` |
| `src/utils/logger.ts` | `log` (info, success, warn, error, dim, dryRun) |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written, with one minor deviation documented below.

### Implementation Notes

**Zod version:** Research specified Zod 4.3.6 but npm resolved to Zod 3.24.x. Zod 4 is a major rewrite with different API surface. Zod 3 is the production-stable widely-deployed version. All schemas were written against Zod 3 API (passthrough() is supported). No impact on functionality.

**Version hardcoded in CLI:** Instead of `import { version } from '../package.json'` (which requires additional tsconfig adjustments for JSON module imports with bundler resolution), hardcoded `'0.1.0'` in cli.ts. This is a stub — the version string will be managed via package.json when the publish pipeline is wired up.

## Self-Check: PASSED

- [x] `package.json` exists at /Users/admin/workspace/claude-hooks/package.json
- [x] `src/cli.ts` exists and contains program.parse
- [x] `src/types/settings.ts` exports ClaudeSettings, HookGroup, HookEntry
- [x] `src/types/hooks.ts` exports HookEvent, hookEventSchema
- [x] `src/registry/types.ts` exports HookDefinition, HookPack, Registry
- [x] Commit 48d8182 verified in git log

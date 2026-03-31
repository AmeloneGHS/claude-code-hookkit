# claude-code-hookkit — Hook Manager CLI

## Overview
Open-source CLI tool for managing Claude Code hooks. "husky for Claude Code." One-command installation of production-tested hooks for security, code quality, cost control, and error recovery. npm-publishable.

## Stack
- **Language:** TypeScript (strict, ES2022 ESM)
- **CLI:** Commander.js 14
- **Validation:** Zod 3
- **Bundler:** tsup → `dist/cli.js`
- **Tests:** Vitest (15 test files)
- **Runtime:** Node.js 18+

## Key Paths

| Path | Purpose |
|------|---------|
| `src/cli.ts` | Entry point — Commander program + 10 command registrations |
| `src/commands/` | 10 commands: init, add, remove, list, test, create, doctor, restore, info |
| `src/config/manager.ts` | Read/write settings.json (indent-preserving) |
| `src/config/merger.ts` | Deep merge hooks into settings (dedup, non-destructive) |
| `src/config/locator.ts` | Path resolution (--scope: project/user/local) |
| `src/config/backup.ts` | Timestamped backup before writes |
| `src/registry/index.ts` | Load bundled registry from registry.json |
| `src/registry/types.ts` | HookDefinition, HookPack interfaces |
| `src/types/hooks.ts` | 25 Claude Code hook events (Zod enums) |
| `src/types/settings.ts` | ClaudeSettings schema |
| `registry/registry.json` | Hook + pack metadata |
| `registry/hooks/*.sh` | 7 bundled POSIX shell hooks |
| `registry/hooks/fixtures/` | Test input JSON per hook |
| `tests/` | 15 test files (commands, config, hooks, registry) |

## Commands

| Task | Command |
|------|---------|
| Build | `npm run build` (tsup) |
| Type check | `npm run typecheck` (tsc --noEmit) |
| Test | `npm test` (vitest) |
| Dev (watch) | `npm run dev` (tsup --watch) |
| Lint | `npm run lint` |
| Prepublish | Build → typecheck → test (automatic) |

## CLI Usage

```bash
npx claude-code-hookkit init                # Scaffold .claude/hooks/
npx claude-code-hookkit add security-pack   # Install pack (2 hooks)
npx claude-code-hookkit add post-edit-lint  # Install single hook
npx claude-code-hookkit remove <name>       # Uninstall hook
npx claude-code-hookkit list                # Show available + installed
npx claude-code-hookkit test --all          # Validate all hooks
npx claude-code-hookkit create my-hook --event PreToolUse  # Scaffold custom
npx claude-code-hookkit doctor              # Health check
npx claude-code-hookkit restore             # Revert settings.json
npx claude-code-hookkit info <hook>         # Show metadata
```

## Bundled Hooks (7)

| Hook | Event | Pack |
|------|-------|------|
| sensitive-path-guard | PreToolUse (Edit\|Write) | security-pack |
| exit-code-enforcer | PreToolUse (Bash) | security-pack |
| post-edit-lint | PostToolUse (Write\|Edit) | quality-pack |
| ts-check | PostToolUse (Write\|Edit) | quality-pack |
| web-budget-gate | PreToolUse (WebSearch\|WebFetch) | cost-pack |
| cost-tracker | PostToolUse (all) | cost-pack |
| error-advisor | PostToolUse (Bash) | error-pack |

## Design Decisions
- **Shell hooks (POSIX):** Match Claude Code native format, zero deps, macOS+Linux
- **Bundled registry:** No remote server in v1, versioned with CLI
- **Deep merge:** Never overwrites user's existing hooks/settings
- **Exit code 2 = block:** Per Claude Code spec (exit 1 does NOT block)
- **Backup before write:** `restore` command reverts last change
- **--dry-run on all writes:** Preview before applying

## Status
- **v1.0.0:** Complete (4 phases, 34 requirements, 26 commits)
- **Next:** npm publish + community launch
- **v2 roadmap:** Remote registry, hook enable/disable, versioning

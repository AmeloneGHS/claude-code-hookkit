# Phase 2: CLI Commands & Hook Registry - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

add/remove/list/doctor commands with bundled hook scripts and pack installation. Users can discover, install, and remove production-grade hooks with a single command.

</domain>

<decisions>
## Implementation Decisions

### add command
- `claude-hooks add <hook>` installs a single hook (copies script to .claude/hooks/, adds entry to settings.json)
- `claude-hooks add <pack>` installs all hooks in a named pack
- Uses the merger engine from Phase 1 (non-destructive, backup before write)
- Sets chmod +x on installed hook scripts
- Prints summary of what was installed

### remove command
- `claude-hooks remove <hook>` removes script file and settings.json entry
- Clean removal — no orphaned entries in either direction
- Warns if hook not found

### list command
- `claude-hooks list` shows all available hooks from registry with installed status
- Columns: name, event, matcher, pack, installed (yes/no)
- Color-coded: installed hooks highlighted

### doctor command
- `claude-hooks doctor` validates installation health
- Checks: scripts exist, scripts are executable, settings.json is valid JSON, hook entries reference existing scripts, no orphaned scripts
- Colored pass/fail output

### Bundled hook scripts
- 7 hooks across 4 packs (defined in registry.json from Phase 1)
- All scripts use exit code 2 to block (per Claude Code spec)
- All scripts are POSIX-compatible (bash 3.2+)
- Scripts read tool JSON from stdin, parse with jq or bash builtins
- Each script has inline comments explaining what it does

### All commands
- Support --scope user|project|local (default: project)
- Support --dry-run where writes are involved (add, remove)
- Support --help with examples

### Claude's Discretion
- Exact script implementations for each hook
- doctor output formatting
- list table formatting
- Error message wording

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 artifacts
- `.planning/phases/01-foundation-settings-engine/01-CONTEXT.md` — Settings handling decisions
- `.planning/phases/01-foundation-settings-engine/01-RESEARCH.md` — Hook JSON schema, event types, pitfalls

### Project definition
- `.planning/PROJECT.md` — Core value prop, constraints
- `.planning/REQUIREMENTS.md` — CLI-02 through CLI-05, CLI-09, CLI-10, REG-03 through REG-08

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/config/manager.ts` — applyMerge, readSettings, writeSettings
- `src/config/locator.ts` — getSettingsPath, getHooksDir, getBackupPath
- `src/config/merger.ts` — pure mergeHooks function
- `src/config/backup.ts` — createBackup, restoreBackup
- `src/registry/index.ts` — loadRegistry, getHook, getPack, listHooks, listPacks
- `src/utils/logger.ts` — colored output helpers
- `src/types/` — all types and Zod schemas

### Established Patterns
- Commander.js commands with lazy imports
- TDD with vitest, tmp directories for file operations
- Pure functions for logic, thin wrappers for I/O

### Integration Points
- CLI entry (src/cli.ts) — register new commands here
- Registry (registry/registry.json) — hook metadata source
- Settings merger — used by add/remove to update settings.json

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard CLI patterns apply.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-cli-commands-hook-registry*
*Context gathered: 2026-03-18*

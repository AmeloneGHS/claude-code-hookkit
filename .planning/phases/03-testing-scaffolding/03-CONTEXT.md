# Phase 3: Testing & Scaffolding - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Hook test runner, test fixtures, and create command with templates. Users can verify hooks work before deploying them and create custom hooks from templates.

</domain>

<decisions>
## Implementation Decisions

### test command
- `claude-hooks test <hook>` — feed mock JSON stdin to hook script, capture exit code + stdout/stderr, report pass/fail
- `claude-hooks test --all` — test every installed hook
- Colored output: green pass, red fail, summary at end
- Each bundled hook ships with test fixtures (JSON input + expected exit code)

### Test fixtures
- Stored alongside hook scripts in registry/hooks/fixtures/
- Format: JSON files with { input: {...}, expectedExitCode: 0|2, description: "..." }
- Auto-discovered by test command based on hook name pattern

### create command
- `claude-hooks create <name> --event <type> --matcher <pattern>` — scaffolds a new custom hook
- Generates: hook script with proper shebang, JSON parsing boilerplate, exit code handling
- Also generates: test fixture skeleton
- Templates for each supported event type (PreToolUse, PostToolUse, etc.)

### Claude's Discretion
- Test output formatting details
- Template script contents
- Fixture file naming convention
- Test runner internals

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/phases/01-foundation-settings-engine/01-RESEARCH.md` — Hook JSON schema for all event types
- `.planning/REQUIREMENTS.md` — CLI-06, CLI-07, CLI-08, TST-01 through TST-04, SCF-01 through SCF-03

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/registry/index.ts` — getHook, listHooks for fixture discovery
- `src/config/locator.ts` — getHooksDir for finding installed hooks
- `src/utils/logger.ts` — colored output
- `registry/hooks/*.sh` — 7 bundled hooks that need fixtures
- `tests/hooks/scripts.test.ts` — existing test patterns (runHook helper) to draw from

### Integration Points
- CLI entry (src/cli.ts) — register test and create commands
- Registry — hook metadata for fixture association

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard patterns.

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>

---

*Phase: 03-testing-scaffolding*
*Context gathered: 2026-03-18*

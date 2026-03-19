# claude-hooks

[![npm version](https://img.shields.io/npm/v/claude-hooks.svg)](https://www.npmjs.com/package/claude-hooks)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**husky for Claude Code** — install, manage, test, and share hooks with a single command.

Go from zero to production-grade Claude Code hooks in under 60 seconds:

```bash
npx claude-hooks init && npx claude-hooks add security-pack
```

---

## What Are Claude Code Hooks?

Claude Code hooks are shell commands triggered by Claude Code events (PreToolUse, PostToolUse, SessionStart, Stop). They run automatically and can:

- **Block** dangerous operations before they execute (exit code 2)
- **Observe** and log what Claude does (exit code 0, advisory)
- **Provide feedback** after actions complete

Hooks are configured in `~/.claude/settings.json` under the `hooks` key. `claude-hooks` manages that configuration for you — non-destructively, with backups.

---

## Quick Start

```bash
# Initialize hook directory and seed settings.json
npx claude-hooks init

# Install the security pack (sensitive-path-guard + exit-code-enforcer)
npx claude-hooks add security-pack

# See what's installed
npx claude-hooks list

# Verify everything is healthy
npx claude-hooks doctor
```

---

## Command Reference

### `claude-hooks init`

Scaffold the hook directory and seed `settings.json`.

```bash
claude-hooks init                    # project scope (default)
claude-hooks init --scope user       # user-level settings (~/.claude/settings.json)
claude-hooks init --dry-run          # preview without writing
```

### `claude-hooks add <name>`

Install a hook or pack from the bundled registry.

```bash
claude-hooks add sensitive-path-guard          # single hook
claude-hooks add security-pack                 # install entire pack
claude-hooks add cost-tracker --scope user     # user-level install
claude-hooks add post-edit-lint --dry-run      # preview changes
```

### `claude-hooks remove <name>`

Remove an installed hook (script + settings.json entry).

```bash
claude-hooks remove sensitive-path-guard
claude-hooks remove post-edit-lint --scope user
claude-hooks remove web-budget-gate --dry-run
```

### `claude-hooks list`

List all available hooks with installed status, event type, and pack.

```bash
claude-hooks list
claude-hooks list --scope user
```

### `claude-hooks test <hook>`

Test a hook with its bundled fixture data. Validates exit code and output.

```bash
claude-hooks test sensitive-path-guard         # test single hook
claude-hooks test --all                        # test all installed hooks
```

### `claude-hooks create <name>`

Scaffold a custom hook from a template.

```bash
claude-hooks create my-guard --event PreToolUse --matcher Bash
claude-hooks create session-logger --event SessionStart
claude-hooks create cleanup --event Stop
```

Generates a working shell script with proper shebang, stdin JSON parsing, and a test fixture skeleton.

### `claude-hooks doctor`

Validate installation health: script existence, permissions, settings.json validity, conflicting hooks.

```bash
claude-hooks doctor
claude-hooks doctor --scope user
```

### `claude-hooks restore`

Revert settings.json to the last backup (created automatically before every write).

```bash
claude-hooks restore
claude-hooks restore --scope user
```

### `claude-hooks info <hook>`

Show full details for a hook: description, event, matcher, pack, and example input JSON.

```bash
claude-hooks info sensitive-path-guard
claude-hooks info web-budget-gate
```

---

## Hook Registry

All 7 bundled hooks ship with the package — no network required.

| Hook | Description | Event | Matcher | Pack |
|------|-------------|-------|---------|------|
| `sensitive-path-guard` | Blocks writes to .env, credentials, private keys | PreToolUse | Edit\|Write | security-pack |
| `exit-code-enforcer` | Blocks known-dangerous shell commands (rm -rf /, fork bombs, etc.) | PreToolUse | Bash | security-pack |
| `post-edit-lint` | Runs linter on files after Claude edits them | PostToolUse | Write\|Edit | quality-pack |
| `ts-check` | Runs TypeScript type checking after code changes | PostToolUse | Write\|Edit | quality-pack |
| `web-budget-gate` | Limits web search/fetch calls per session to control costs | PreToolUse | WebSearch\|WebFetch | cost-pack |
| `cost-tracker` | Tracks tool usage costs per session | PostToolUse | — | cost-pack |
| `error-advisor` | Provides contextual fix suggestions when commands fail | PostToolUse | Bash | error-pack |

---

## Packs

Install related hooks together in one command.

### `security-pack`

Essential security hooks. Blocks writes to sensitive files and dangerous shell commands.

```bash
claude-hooks add security-pack
```

Includes: `sensitive-path-guard`, `exit-code-enforcer`

### `quality-pack`

Code quality hooks that run automatically after Claude edits files.

```bash
claude-hooks add quality-pack
```

Includes: `post-edit-lint`, `ts-check`

### `cost-pack`

Cost control hooks. Limit web calls per session and track tool usage.

```bash
claude-hooks add cost-pack
```

Includes: `web-budget-gate`, `cost-tracker`

### `error-pack`

Error recovery. When a Bash command fails, this hook analyzes the output and suggests contextual fixes.

```bash
claude-hooks add error-pack
```

Includes: `error-advisor`

---

## How Hooks Work

Claude Code evaluates hooks from your `settings.json`. Example entry added by `claude-hooks add`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/.claude/hooks/sensitive-path-guard.sh"
          }
        ]
      }
    ]
  }
}
```

**Exit codes:**
- `0` — allow the operation (or advisory-only PostToolUse hook)
- `2` — block the operation (Claude Code spec; exit 1 does not block)

**Input format:** Claude Code passes JSON via stdin. Hooks read it with `INPUT=$(cat)` and parse fields with `grep`/`sed` (no `jq` required — POSIX-compatible).

---

## Creating Custom Hooks

Scaffold a hook with the right structure:

```bash
claude-hooks create my-guard --event PreToolUse --matcher Bash
```

This creates:
- `.claude/hooks/my-guard.sh` — working hook script
- `.claude/hooks/fixtures/my-guard/allow-example.json` — test fixture skeleton

The generated script handles stdin JSON parsing, includes commented examples, and uses the correct exit codes. Edit the pattern-matching logic and add your fixture test cases, then run:

```bash
claude-hooks test my-guard
```

### Hook Template Pattern

```bash
#!/bin/bash
INPUT=$(cat)

# Extract what you need from tool JSON
VALUE=$(printf '%s' "$INPUT" | grep -o '"field"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*: *"//; s/"//')

# Your logic here
if [[ "$VALUE" == "bad-value" ]]; then
  printf 'BLOCKED: reason\n' >&2
  exit 2
fi

exit 0
```

### Fixture Format

```json
{
  "description": "What this fixture tests",
  "input": { "tool_input": { "file_path": ".env" } },
  "expectedExitCode": 2
}
```

---

## Settings Scope

All commands support `--scope`:

| Scope | Settings File | Hook Directory |
|-------|---------------|----------------|
| `project` (default) | `.claude/settings.json` | `.claude/hooks/` |
| `user` | `~/.claude/settings.json` | `~/.claude/hooks/` |
| `local` | `.claude/settings.local.json` | `.claude/hooks/` |

`add` and `init` always perform a deep merge — your existing settings are never overwritten.

---

## Contributing

1. Fork the repo
2. Add your hook to `registry/hooks/` with inline comments
3. Add metadata to `registry/registry.json`
4. Add test fixtures to `registry/hooks/fixtures/<hook-name>/`
5. Run `npm test` — all fixtures must pass
6. Submit a PR with a description of what the hook does and why it's useful

Hooks must be:
- POSIX-compatible (macOS bash 3.2 + Linux bash 5.x)
- No external dependencies (no `jq`, no `python`, no `node`)
- Exit code 2 to block, exit code 0 to allow
- Include at least one allow fixture and one block fixture

---

## License

MIT — Copyright (c) 2026 Austin Amelone

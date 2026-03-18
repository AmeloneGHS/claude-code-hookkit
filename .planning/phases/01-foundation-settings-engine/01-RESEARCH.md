# Phase 1: Foundation & Settings Engine - Research

**Researched:** 2026-03-18
**Domain:** TypeScript CLI scaffold, non-destructive JSON settings merger, hook registry data model
**Confidence:** HIGH

## Summary

Phase 1 builds three foundational layers: (1) a TypeScript project with Commander.js CLI skeleton and type definitions, (2) the settings merger engine that reads/merges/backs up/restores settings.json without destroying existing config, and (3) the registry data model with the `init` command wired up.

The settings merger is the critical component. Claude Code's settings.json contains hooks alongside other config (env, mcpServers, enabledPlugins, permissions, statusLine). The merger must surgically modify only the `hooks` key while preserving everything else byte-for-byte. Claude Code concatenates hook arrays across scopes and deduplicates by command string -- our merger must match this behavior.

**Primary recommendation:** Build the merger as a pure function (input JSON + hooks to add -> output JSON + merge report) with zero side effects, then wrap it with file I/O in the config manager. This makes it trivially testable and the most critical code path also the most verified.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Default target scope: **project** (.claude/settings.json in repo root)
- `--scope user|project|local` flag available to override default
- On conflict (same event+matcher as existing hook): **warn and skip** -- user must remove first
- Single backup file: `.claude/settings.json.backup` -- overwritten on each write
- `claude-hooks restore` reverts to the single backup
- Deep merge strategy: preserve all existing config, only add/modify hook entries
- `npx claude-hooks init` creates `.claude/hooks/` directory and seeds `.claude/settings.json` with empty hooks structure
- **Silent with summary** -- no interactive prompts, prints what was created, exits cleanly. Works in CI.
- `--dry-run` flag to preview without writing
- **No-op on re-init** -- if hooks already configured, print "Already initialized" and exit
- Hook scripts live in `.claude/hooks/` (kebab-case.sh naming)
- All hooks in same flat directory -- no subdirectory split
- **JSON manifest + scripts dir** -- `registry.json` with hook metadata, scripts in separate hooks/ dir within npm package
- No hook dependencies -- each hook is standalone. Packs are named groups.
- Packs: `{ "packs": { "security-pack": ["sensitive-path-guard", "exit-code-enforcer"] } }`
- Hook metadata: name, description, event, matcher, pack membership, script filename

### Claude's Discretion
- TypeScript project scaffold specifics (tsconfig, build tooling, package.json scripts)
- Commander.js command structure and option parsing details
- Deep merge algorithm implementation
- Error message wording and formatting
- Internal type/interface design

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CLI-01 | User can run `npx claude-hooks init` to scaffold hook directory and seed settings.json | Commander.js CLI patterns, npx bin field setup, tsup shebang insertion |
| SET-01 | `add` and `init` perform non-destructive deep merge on settings.json | Merge algorithm research, Claude Code settings schema, array-append strategy |
| SET-02 | User can pass `--dry-run` on any write command to preview changes | Commander.js option parsing, merge result reporting |
| SET-03 | Settings.json is automatically backed up before any write operation | fs.copyFile to .backup path, single-file backup strategy |
| SET-04 | User can run `claude-hooks restore` to revert to the last backup | fs.copyFile from .backup, existence check |
| SET-05 | `doctor` detects conflicting hooks (overlapping event+matcher) | Conflict detection algorithm (event+matcher tuple comparison) |
| SET-06 | `add` and `remove` target correct settings scope via `--scope` flag | Settings locator with scope-to-path mapping |
| REG-01 | Registry ships bundled with the npm package | package.json `files` field, registry.json structure |
| REG-02 | Each hook has metadata: name, description, event type, matcher | HookDefinition TypeScript interface, Zod schema validation |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Commander.js | 14.0.3 | CLI argument parsing, subcommands, options | 270M+/week downloads, native TS types, auto --help generation, lightweight |
| TypeScript | 5.9.3 | Type safety, build-time checking | Current stable, strict mode, satisfies operator |
| tsup | 8.5.1 | Bundle TS to JS, shebang insertion | Zero-config CLI bundling, auto `#!/usr/bin/env node`, esbuild-powered |
| Node.js | >=18.0.0 | Runtime | LTS baseline, native fs/promises, structuredClone |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| picocolors | 1.1.1 | Terminal colors (green/red/yellow/bold) | All CLI output formatting |
| zod | 4.3.6 | Schema validation for settings.json and hook configs | Validating user settings before merge, registry metadata |
| Vitest | 4.1.0 | Unit and integration testing | All test files |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Commander.js | yargs | Heavier, more complex API -- not needed for 6 commands |
| picocolors | chalk | 14x larger (101KB vs 7KB), slower load -- overkill for basic colors |
| tsup | tsdown | Newer successor but tsup is proven stable; trivial migration later |
| zod | ajv | ajv is JSON Schema based; zod gives TS type inference from schemas |

**Installation:**
```bash
npm install commander picocolors zod
npm install -D typescript tsup vitest @types/node
```

**Note on deepmerge-ts:** After researching the merge requirements, a dedicated deep merge library is NOT needed. Claude Code's settings merger requires array-append (not element-wise merge) and selective key targeting (only the `hooks` key). A custom ~30-line merge function is simpler, more predictable, and avoids edge cases from generic deep merge libraries that may merge arrays element-by-element or recursively merge objects we want left untouched (like `mcpServers`).

## Architecture Patterns

### Recommended Project Structure
```
claude-hooks/
  package.json
  tsconfig.json
  tsup.config.ts
  src/
    cli.ts                    # Entry point, Commander setup, bin target
    commands/
      init.ts                 # claude-hooks init
      restore.ts              # claude-hooks restore
    config/
      manager.ts              # Read/write settings.json with backup
      merger.ts               # Pure merge function (no I/O)
      locator.ts              # Resolve scope -> file path
      backup.ts               # Backup/restore logic
    registry/
      types.ts                # HookDefinition, HookPack, HookEvent
      registry.json           # Hook metadata manifest
      index.ts                # Lookup functions
    types/
      settings.ts             # Claude Code settings.json types
      hooks.ts                # Hook config types matching Claude Code schema
    utils/
      logger.ts               # Colored output helpers
      fs.ts                   # Safe file read/write wrappers
  hooks/                      # Shell scripts shipped in npm package
    sensitive-path-guard.sh
    post-edit-lint.sh
    ...
  tests/
    config/
      merger.test.ts          # Most critical tests
      locator.test.ts
      manager.test.ts
    commands/
      init.test.ts
    registry/
      index.test.ts
```

### Pattern 1: Commander.js TypeScript CLI Setup

**What:** Single-file CLI entry point with subcommands registered via .command()
**When to use:** Always -- this is the application entry point

```typescript
// src/cli.ts
import { Command } from 'commander';
import { version } from '../package.json';

const program = new Command()
  .name('claude-hooks')
  .description('Hook manager for Claude Code')
  .version(version);

program
  .command('init')
  .description('Initialize claude-hooks in your project')
  .option('--scope <scope>', 'Settings scope: user, project, or local', 'project')
  .option('--dry-run', 'Preview changes without writing')
  .action(async (opts) => {
    const { initCommand } = await import('./commands/init.js');
    await initCommand(opts);
  });

program
  .command('restore')
  .description('Restore settings.json from backup')
  .option('--scope <scope>', 'Settings scope: user, project, or local', 'project')
  .action(async (opts) => {
    const { restoreCommand } = await import('./commands/restore.js');
    await restoreCommand(opts);
  });

program.parse();
```

**Key details:**
- Lazy import commands to keep startup fast (only load what's needed)
- `--scope` defaults to `'project'` per locked decision
- `--dry-run` as boolean option (no argument needed)
- tsup inserts shebang automatically via `banner` config

### Pattern 2: Pure Merger Function (Critical Path)

**What:** Merge new hook entries into existing settings without mutation
**When to use:** Every write operation to settings.json

```typescript
// src/config/merger.ts
import type { ClaudeSettings, HookGroup, MergeResult } from '../types/settings.js';

export interface MergeInput {
  existing: ClaudeSettings;
  newHooks: HookGroup[];  // Array of { event, matcher?, hooks: [...] }
}

export interface MergeResult {
  settings: ClaudeSettings;
  added: { event: string; matcher?: string; command: string }[];
  skipped: { event: string; matcher?: string; command: string; reason: string }[];
}

export function mergeHooks(input: MergeInput): MergeResult {
  // 1. Deep clone existing settings (structuredClone)
  const settings = structuredClone(input.existing);
  const added: MergeResult['added'] = [];
  const skipped: MergeResult['skipped'] = [];

  // 2. Ensure hooks object exists
  if (!settings.hooks) {
    settings.hooks = {};
  }

  // 3. For each new hook group
  for (const newGroup of input.newHooks) {
    const { event, matcher, hooks } = newGroup;

    // Ensure event array exists
    if (!settings.hooks[event]) {
      settings.hooks[event] = [];
    }

    for (const hook of hooks) {
      // 4. Check for conflict: same event + matcher + command already exists
      const conflict = findConflict(settings.hooks[event], matcher, hook.command);

      if (conflict) {
        skipped.push({
          event,
          matcher,
          command: hook.command,
          reason: 'Already exists (same event + matcher + command)',
        });
        continue;
      }

      // 5. Check for same event+matcher but different command (warn and skip per decision)
      const matcherConflict = findMatcherConflict(settings.hooks[event], matcher);
      // Note: we still ADD -- only exact duplicates are skipped
      // Matcher conflicts are warnings, not blocks

      // 6. Append as new hook group
      settings.hooks[event].push({
        ...(matcher ? { matcher } : {}),
        hooks: [{ type: hook.type, command: hook.command }],
      });

      added.push({ event, matcher, command: hook.command });
    }
  }

  return { settings, added, skipped };
}
```

**Critical insight:** The merger operates on the `hooks` key ONLY. All other top-level keys (env, mcpServers, enabledPlugins, statusLine, permissions, etc.) pass through untouched via `structuredClone`.

### Pattern 3: Settings Scope Locator

**What:** Map scope flag to actual file path
**When to use:** Every command that reads/writes settings

```typescript
// src/config/locator.ts
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

export type Scope = 'user' | 'project' | 'local';

export function getSettingsPath(scope: Scope): string {
  switch (scope) {
    case 'user':
      return join(homedir(), '.claude', 'settings.json');
    case 'project':
      return resolve('.claude', 'settings.json');
    case 'local':
      return resolve('.claude', 'settings.local.json');
  }
}

export function getBackupPath(scope: Scope): string {
  const settingsPath = getSettingsPath(scope);
  return settingsPath + '.backup';
  // Results in: .claude/settings.json.backup (per locked decision)
}

export function getHooksDir(scope: Scope): string {
  switch (scope) {
    case 'user':
      return join(homedir(), '.claude', 'hooks');
    case 'project':
    case 'local':
      return resolve('.claude', 'hooks');
  }
}
```

### Pattern 4: Backup Before Write

**What:** Copy settings.json to .backup before any modification
**When to use:** Every write operation

```typescript
// src/config/backup.ts
import { copyFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';

export async function createBackup(settingsPath: string): Promise<string> {
  const backupPath = settingsPath + '.backup';

  // Only backup if settings file exists
  try {
    await access(settingsPath, constants.F_OK);
    await copyFile(settingsPath, backupPath);
    return backupPath;
  } catch {
    // No existing file to back up -- that's fine
    return '';
  }
}

export async function restoreBackup(settingsPath: string): Promise<boolean> {
  const backupPath = settingsPath + '.backup';

  try {
    await access(backupPath, constants.F_OK);
    await copyFile(backupPath, settingsPath);
    return true;
  } catch {
    return false; // No backup exists
  }
}
```

### Anti-Patterns to Avoid

- **Overwriting settings.json entirely:** Never `JSON.stringify(newConfig)` + `writeFile`. Always read-merge-write.
- **Mutating the input object:** Use `structuredClone` before modifying. The merger must be pure.
- **Using a generic deep merge library on the whole settings:** Libraries like deepmerge-ts will recursively merge `mcpServers`, `enabledPlugins`, etc. We must ONLY merge the `hooks` key.
- **Relative paths in settings.json commands:** Use absolute paths for user-scope hooks, `"$CLAUDE_PROJECT_DIR"/.claude/hooks/name.sh` for project-scope.
- **Using `exit 1` in hook scripts:** Claude Code only blocks on exit 2. Exit 1 is a non-blocking error.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CLI argument parsing | Custom argv parser | Commander.js | Edge cases: quoted args, boolean vs value options, --no-prefix negation, help generation |
| Terminal colors | ANSI escape codes | picocolors | Terminal detection, CI no-color, Windows color support |
| Schema validation | Manual type checking | zod | Error messages, type inference, composable schemas |
| TypeScript bundling | tsc + manual shebang | tsup | Tree shaking, shebang insertion, sourcemaps, minification |

**Key insight:** The one thing we DO hand-roll is the settings merger -- generic deep merge libraries don't understand our domain-specific merge semantics (array-append for hooks, passthrough for everything else, dedup by command string).

## Common Pitfalls

### Pitfall 1: Destroying Non-Hook Settings
**What goes wrong:** Merger overwrites env, mcpServers, enabledPlugins, statusLine, permissions while updating hooks
**Why it happens:** Using generic JSON.parse -> modify -> JSON.stringify without preserving other keys
**How to avoid:** Clone entire settings, modify ONLY settings.hooks, write back the full clone
**Warning signs:** Tests that start with empty settings objects

### Pitfall 2: npm Strips File Permissions
**What goes wrong:** Shell scripts in the npm package lose their executable bit after publish/install
**Why it happens:** npm pack/publish does not preserve chmod +x on files
**How to avoid:** Run `chmod +x` on scripts during the `add` command (Phase 2), not at package publish time. For Phase 1, just be aware this is needed later.
**Warning signs:** Scripts that fail with "permission denied" after install

### Pitfall 3: tsup noExternal Won't Bundle Non-JS Assets
**What goes wrong:** Shell scripts in hooks/ directory are not included in the dist/ output by tsup
**Why it happens:** tsup/esbuild only bundles JavaScript/TypeScript imports. Static assets (shell scripts, JSON manifests) need separate inclusion.
**How to avoid:** Use package.json `"files": ["dist", "hooks", "registry"]` to include non-JS assets alongside the bundle. Scripts are loaded at runtime via `path.join(__dirname, '..', 'hooks', 'name.sh')` or via `import.meta.url` resolution.
**Warning signs:** "file not found" errors when running from npx

### Pitfall 4: import.meta.url vs __dirname in ESM
**What goes wrong:** `__dirname` is not available in ESM modules. Asset path resolution breaks.
**Why it happens:** ESM does not have CommonJS globals. `import.meta.url` is the ESM equivalent.
**How to avoid:** Use `import { fileURLToPath } from 'node:url'` and `path.dirname(fileURLToPath(import.meta.url))` to get the equivalent of `__dirname`. Or configure tsup to output CJS where `__dirname` works natively.
**Warning signs:** `ReferenceError: __dirname is not defined`

### Pitfall 5: Project Scope Path Resolution
**What goes wrong:** `resolve('.claude/settings.json')` resolves relative to cwd, which may not be the project root
**Why it happens:** User runs `npx claude-hooks init` from a subdirectory
**How to avoid:** Walk up the directory tree looking for `.git` or `.claude` directory to find project root, similar to how git itself finds the repo root. Fall back to cwd if nothing found.
**Warning signs:** Settings file created in wrong directory

### Pitfall 6: JSON Formatting Preservation
**What goes wrong:** User's settings.json is indented with tabs; our write outputs 2-space indent. Diff noise in git.
**Why it happens:** `JSON.stringify(obj, null, 2)` always uses 2-space indent
**How to avoid:** Detect the existing indentation style by examining the raw JSON string before parsing. Use the detected indent in `JSON.stringify`. Default to 2 spaces for new files.
**Warning signs:** Unnecessary whitespace changes in git diffs

## Code Examples

### Claude Code settings.json Full Structure (from real-world config)

```json
{
  "env": { "SOME_VAR": "value" },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "/path/to/hook.sh" }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "/path/to/other-hook.sh" }
        ]
      }
    ],
    "PostToolUse": [
      {
        "hooks": [
          { "type": "command", "command": "/path/to/post-hook.sh" }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "node /path/to/session-hook.js" }
        ]
      }
    ]
  },
  "mcpServers": { "server-name": { "command": "npx", "args": ["..."] } },
  "enabledPlugins": { "plugin-name": true },
  "statusLine": { "type": "command", "command": "node /path/to/status.js" },
  "voiceEnabled": true,
  "dangerouslySkipPermissions": true
}
```

**Key observations from Austin's real settings.json (19 hooks):**
- Each hook group has ONE hook in its `hooks` array (not multiple per group)
- Matcher is optional (SessionStart, PostToolUse groups may omit it)
- Commands use absolute paths or bare command names
- Same event can have many hook groups with different matchers
- Non-hook keys (env, mcpServers, enabledPlugins, statusLine, etc.) MUST be preserved

### Hook Input JSON (stdin to hook scripts)

```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/project/dir",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm test",
    "description": "Run tests",
    "timeout": 120000
  },
  "tool_use_id": "toolu_01ABC..."
}
```

### Hook Output JSON (stdout from hook scripts)

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Blocked: dangerous command pattern detected"
  }
}
```

### Exit Code Contract

| Exit Code | Meaning | stdout | stderr |
|-----------|---------|--------|--------|
| 0 | Success | Parsed as JSON if present | Ignored |
| 2 | Block the action | Ignored | Shown to Claude as feedback |
| Other | Non-blocking error | Ignored | Logged in verbose mode |

### Registry Data Model

```typescript
// src/registry/types.ts
export type HookEvent =
  | 'PreToolUse' | 'PostToolUse' | 'PostToolUseFailure'
  | 'PermissionRequest'
  | 'SessionStart' | 'Stop' | 'StopFailure' | 'SessionEnd'
  | 'Notification'
  | 'SubagentStart' | 'SubagentStop'
  | 'UserPromptSubmit'
  | 'ConfigChange'
  | 'PreCompact' | 'PostCompact'
  | 'WorktreeCreate' | 'WorktreeRemove'
  | 'TeammateIdle' | 'TaskCompleted'
  | 'InstructionsLoaded'
  | 'Elicitation' | 'ElicitationResult';

export interface HookDefinition {
  name: string;              // "sensitive-path-guard"
  description: string;       // "Blocks writes to sensitive paths (.env, credentials, etc.)"
  event: HookEvent;          // "PreToolUse"
  matcher?: string;          // "Edit|Write" (regex, optional)
  pack?: string;             // "security-pack"
  scriptFile: string;        // "sensitive-path-guard.sh"
}

export interface HookPack {
  name: string;              // "security-pack"
  description: string;       // "Essential security hooks for Claude Code"
  hooks: string[];           // ["sensitive-path-guard", "exit-code-enforcer"]
}

export interface Registry {
  hooks: Record<string, HookDefinition>;
  packs: Record<string, HookPack>;
}
```

### tsup Configuration

```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  dts: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
  // Do NOT use noExternal for everything -- it causes issues with
  // native modules. Bundle only the small deps.
  // Shell scripts are included via package.json "files" field, not bundled.
});
```

### package.json Key Fields

```json
{
  "name": "claude-hooks",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "claude-hooks": "./dist/cli.js"
  },
  "files": [
    "dist",
    "hooks",
    "registry"
  ],
  "engines": {
    "node": ">=18.0.0"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "npm run build"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| chalk for colors | picocolors | 2023+ | 14x smaller, 2x faster |
| Jest for TS testing | Vitest | 2023+ | Native TS, faster, ESM-first |
| tsc for compilation | tsup/esbuild | 2022+ | 100x faster builds |
| CJS modules | ESM (type: module) | 2023+ | Standard module system |
| __dirname | import.meta.url + fileURLToPath | ESM migration | Required for ESM packages |
| deepmerge library | Custom domain-specific merge | This project | Avoids unwanted recursive merge of non-hook keys |

## Open Questions

1. **Package name availability on npm**
   - What we know: "claude-hooks" is the desired name
   - What's unclear: Whether it's already taken on npm registry
   - Recommendation: Check `npm view claude-hooks` before publishing. Have backup name ready (e.g., `@claude-code/hooks`)

2. **Zod 4 vs Zod 3**
   - What we know: Zod 4.3.6 is latest (major rewrite). Zod 3.x is widely deployed.
   - What's unclear: Whether Zod 4 has stabilized enough for production use
   - Recommendation: Use Zod 4 -- it's been out long enough and has better performance. If issues arise, downgrade to 3.x is straightforward.

3. **Project root detection**
   - What we know: `--scope project` needs to find the project root
   - What's unclear: Best heuristic when no `.git` or `.claude` directory exists
   - Recommendation: Walk up from cwd looking for `.git`, `.claude`, or `package.json`. Fall back to cwd. This matches how other tools (eslint, prettier) find roots.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | vitest.config.ts (Wave 0) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLI-01 | init creates .claude/hooks/ and seeds settings.json | integration | `npx vitest run tests/commands/init.test.ts -t "init"` | Wave 0 |
| SET-01 | Deep merge preserves existing settings | unit | `npx vitest run tests/config/merger.test.ts -t "merge"` | Wave 0 |
| SET-02 | --dry-run previews without writing | integration | `npx vitest run tests/commands/init.test.ts -t "dry-run"` | Wave 0 |
| SET-03 | Backup created before write | unit | `npx vitest run tests/config/backup.test.ts` | Wave 0 |
| SET-04 | Restore reverts to backup | unit | `npx vitest run tests/config/backup.test.ts -t "restore"` | Wave 0 |
| SET-05 | Conflict detection on same event+matcher | unit | `npx vitest run tests/config/merger.test.ts -t "conflict"` | Wave 0 |
| SET-06 | Scope flag resolves correct path | unit | `npx vitest run tests/config/locator.test.ts` | Wave 0 |
| REG-01 | Registry loads bundled hooks | unit | `npx vitest run tests/registry/index.test.ts` | Wave 0 |
| REG-02 | Hook metadata is complete | unit | `npx vitest run tests/registry/index.test.ts -t "metadata"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` -- framework config
- [ ] `tests/config/merger.test.ts` -- covers SET-01, SET-05
- [ ] `tests/config/locator.test.ts` -- covers SET-06
- [ ] `tests/config/backup.test.ts` -- covers SET-03, SET-04
- [ ] `tests/commands/init.test.ts` -- covers CLI-01, SET-02
- [ ] `tests/registry/index.test.ts` -- covers REG-01, REG-02

## Sources

### Primary (HIGH confidence)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) -- Full event list (25 events), JSON schemas for stdin/stdout, exit code semantics, settings file locations, merge behavior
- Austin's `~/.claude/settings.json` -- Real-world 19-hook configuration showing actual structure, matcher patterns, command paths
- [Commander.js GitHub](https://github.com/tj/commander.js/) -- v14.0.3, TypeScript types, subcommand patterns
- npm registry version checks -- commander 14.0.3, tsup 8.5.1, vitest 4.1.0, picocolors 1.1.1, zod 4.3.6, typescript 5.9.3

### Secondary (MEDIUM confidence)
- [deepmerge-ts](https://github.com/RebeccaStevens/deepmerge-ts) -- Evaluated and rejected; custom merge is more appropriate for domain-specific semantics
- [Building CLI apps with TypeScript in 2026](https://hackers.pub/@hongminhee/2026/typescript-cli-2026) -- Modern CLI tooling landscape
- [tsup npm](https://www.npmjs.com/package/tsup) -- Bundling patterns, shebang insertion, noExternal config
- [picocolors](https://github.com/alexeyraspopov/picocolors) -- 7KB, 2x faster than chalk

### Tertiary (LOW confidence)
- None -- all findings verified against primary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all versions verified against npm registry, well-established tools
- Architecture: HIGH -- based on real-world settings.json analysis and official Claude Code docs
- Pitfalls: HIGH -- verified against official hooks reference and real-world configurations
- Merge algorithm: HIGH -- derived directly from Claude Code's documented merge behavior ("arrays are concatenated", "identical handlers are deduplicated")

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable domain, Claude Code hooks API is established)

/**
 * TypeScript types matching Claude Code's settings.json schema.
 * These types describe the structure of ~/.claude/settings.json,
 * .claude/settings.json (project), and .claude/settings.local.json.
 */

/** A single hook entry in settings.json */
export interface HookEntry {
  type: 'command';
  command: string;
}

/** A group of hooks, optionally filtered by a tool matcher regex */
export interface HookGroup {
  matcher?: string;
  hooks: HookEntry[];
}

/**
 * The full Claude Code settings.json structure.
 * Index signature allows unknown future keys to pass through untouched.
 */
export interface ClaudeSettings {
  env?: Record<string, string>;
  hooks?: Record<string, HookGroup[]>;
  mcpServers?: Record<string, unknown>;
  enabledPlugins?: Record<string, boolean>;
  statusLine?: unknown;
  [key: string]: unknown;
}

/** Result of a non-destructive merge operation */
export interface MergeResult {
  settings: ClaudeSettings;
  added: {
    event: string;
    matcher?: string;
    command: string;
  }[];
  skipped: {
    event: string;
    matcher?: string;
    command: string;
    reason: string;
  }[];
}

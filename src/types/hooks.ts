import { z } from 'zod';

/**
 * All 25 hook events supported by Claude Code.
 * Source: https://code.claude.com/docs/en/hooks
 */
export type HookEvent =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PostToolUseFailure'
  | 'PermissionRequest'
  | 'SessionStart'
  | 'Stop'
  | 'StopFailure'
  | 'SessionEnd'
  | 'Notification'
  | 'SubagentStart'
  | 'SubagentStop'
  | 'UserPromptSubmit'
  | 'ConfigChange'
  | 'PreCompact'
  | 'PostCompact'
  | 'WorktreeCreate'
  | 'WorktreeRemove'
  | 'TeammateIdle'
  | 'TaskCompleted'
  | 'InstructionsLoaded'
  | 'Elicitation'
  | 'ElicitationResult';

/** Zod enum covering all Claude Code hook events */
export const hookEventSchema = z.enum([
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'PermissionRequest',
  'SessionStart',
  'Stop',
  'StopFailure',
  'SessionEnd',
  'Notification',
  'SubagentStart',
  'SubagentStop',
  'UserPromptSubmit',
  'ConfigChange',
  'PreCompact',
  'PostCompact',
  'WorktreeCreate',
  'WorktreeRemove',
  'TeammateIdle',
  'TaskCompleted',
  'InstructionsLoaded',
  'Elicitation',
  'ElicitationResult',
]);

/** Zod schema for a single hook entry (command type) */
export const hookEntrySchema = z.object({
  type: z.literal('command'),
  command: z.string().min(1),
});

/** Zod schema for a hook group (optional matcher + array of hooks) */
export const hookGroupSchema = z.object({
  matcher: z.string().optional(),
  hooks: z.array(hookEntrySchema),
});

/**
 * Zod schema for the full Claude Code settings.json structure.
 * Uses passthrough() so unknown top-level keys are preserved.
 */
export const claudeSettingsSchema = z
  .object({
    env: z.record(z.string()).optional(),
    hooks: z.record(z.array(hookGroupSchema)).optional(),
    mcpServers: z.record(z.unknown()).optional(),
    enabledPlugins: z.record(z.boolean()).optional(),
    statusLine: z.unknown().optional(),
  })
  .passthrough();

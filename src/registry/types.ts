import { z } from 'zod';
import { hookEventSchema } from '../types/hooks.js';
import type { HookEvent } from '../types/hooks.js';

export type { HookEvent };

/** Metadata for a single hook in the registry */
export interface HookDefinition {
  name: string;        // "sensitive-path-guard"
  description: string; // "Blocks writes to sensitive paths (.env, credentials, etc.)"
  event: HookEvent;    // "PreToolUse"
  matcher?: string;    // "Edit|Write" (regex, optional)
  pack?: string;       // "security-pack" (optional pack membership)
  scriptFile: string;  // "sensitive-path-guard.sh"
}

/** A named collection of related hooks */
export interface HookPack {
  name: string;        // "security-pack"
  description: string; // "Essential security hooks for Claude Code"
  hooks: string[];     // ["sensitive-path-guard", "exit-code-enforcer"]
}

/** The full registry manifest */
export interface Registry {
  hooks: Record<string, HookDefinition>;
  packs: Record<string, HookPack>;
}

/** Zod schema for a single hook definition */
export const hookDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  event: hookEventSchema,
  matcher: z.string().optional(),
  pack: z.string().optional(),
  scriptFile: z.string().min(1),
});

/** Zod schema for a hook pack */
export const hookPackSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  hooks: z.array(z.string()),
});

/** Zod schema for the full registry manifest */
export const registrySchema = z.object({
  hooks: z.record(hookDefinitionSchema),
  packs: z.record(hookPackSchema),
});

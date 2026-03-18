import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { registrySchema } from './types.js';
import type { Registry, HookDefinition, HookPack } from './types.js';

// Resolve registry.json relative to this file's location at runtime.
// Works for both src/ (ts-node/vitest) and dist/ (built output).
const _require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache after first load — registry.json is static at runtime
let _cache: Registry | null = null;

/**
 * Load and validate the registry manifest from registry/registry.json.
 * Caches the result after first call — subsequent calls return the same object.
 * Throws if registry.json is missing or fails schema validation.
 */
export function loadRegistry(): Registry {
  if (_cache !== null) {
    return _cache;
  }

  // registry/ directory lives at the package root, two levels up from src/registry/
  const registryPath = join(__dirname, '..', '..', 'registry', 'registry.json');
  const raw = _require(registryPath) as unknown;

  const parsed = registrySchema.parse(raw);
  _cache = parsed as Registry;
  return _cache;
}

/**
 * Look up a single hook definition by name.
 * Returns undefined if no hook with that name exists.
 */
export function getHook(name: string): HookDefinition | undefined {
  return loadRegistry().hooks[name];
}

/**
 * Look up a hook pack by name.
 * Returns undefined if no pack with that name exists.
 */
export function getPack(name: string): HookPack | undefined {
  return loadRegistry().packs[name];
}

/**
 * Return all hook definitions as an array.
 */
export function listHooks(): HookDefinition[] {
  return Object.values(loadRegistry().hooks);
}

/**
 * Return all hook packs as an array.
 */
export function listPacks(): HookPack[] {
  return Object.values(loadRegistry().packs);
}

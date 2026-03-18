import { describe, it, expect } from 'vitest';
import {
  loadRegistry,
  getHook,
  getPack,
  listHooks,
  listPacks,
} from '../../src/registry/index.js';

const EXPECTED_HOOKS = [
  'sensitive-path-guard',
  'exit-code-enforcer',
  'post-edit-lint',
  'ts-check',
  'web-budget-gate',
  'cost-tracker',
  'error-advisor',
];

const EXPECTED_PACKS = ['security-pack', 'quality-pack', 'cost-pack', 'error-pack'];

describe('loadRegistry', () => {
  it('returns a valid Registry object', () => {
    const registry = loadRegistry();
    expect(registry).toBeDefined();
    expect(registry.hooks).toBeDefined();
    expect(registry.packs).toBeDefined();
    expect(typeof registry.hooks).toBe('object');
    expect(typeof registry.packs).toBe('object');
  });

  it('contains all expected hooks', () => {
    const registry = loadRegistry();
    for (const hookName of EXPECTED_HOOKS) {
      expect(registry.hooks[hookName], `missing hook: ${hookName}`).toBeDefined();
    }
  });

  it('every hook has required fields: name, description, event, scriptFile', () => {
    const registry = loadRegistry();
    for (const [key, hook] of Object.entries(registry.hooks)) {
      expect(hook.name, `${key} missing name`).toBeTruthy();
      expect(hook.description, `${key} missing description`).toBeTruthy();
      expect(hook.event, `${key} missing event`).toBeTruthy();
      expect(hook.scriptFile, `${key} missing scriptFile`).toBeTruthy();
    }
  });

  it('returns cached instance on second call', () => {
    const first = loadRegistry();
    const second = loadRegistry();
    expect(first).toBe(second);
  });
});

describe('getHook', () => {
  it("returns correct definition for 'sensitive-path-guard'", () => {
    const hook = getHook('sensitive-path-guard');
    expect(hook).toBeDefined();
    expect(hook?.name).toBe('sensitive-path-guard');
    expect(hook?.event).toBe('PreToolUse');
    expect(hook?.matcher).toBe('Edit|Write');
    expect(hook?.pack).toBe('security-pack');
    expect(hook?.scriptFile).toBe('sensitive-path-guard.sh');
  });

  it('returns undefined for a nonexistent hook', () => {
    const hook = getHook('nonexistent-hook');
    expect(hook).toBeUndefined();
  });
});

describe('getPack', () => {
  it("returns pack with correct hook list for 'security-pack'", () => {
    const pack = getPack('security-pack');
    expect(pack).toBeDefined();
    expect(pack?.name).toBe('security-pack');
    expect(pack?.hooks).toContain('sensitive-path-guard');
    expect(pack?.hooks).toContain('exit-code-enforcer');
  });

  it('returns undefined for a nonexistent pack', () => {
    const pack = getPack('nonexistent-pack');
    expect(pack).toBeUndefined();
  });
});

describe('listHooks', () => {
  it('returns array of all hook definitions', () => {
    const hooks = listHooks();
    expect(Array.isArray(hooks)).toBe(true);
    expect(hooks.length).toBeGreaterThanOrEqual(EXPECTED_HOOKS.length);
  });

  it('contains all expected hooks by name', () => {
    const hooks = listHooks();
    const names = hooks.map((h) => h.name);
    for (const expected of EXPECTED_HOOKS) {
      expect(names, `listHooks missing: ${expected}`).toContain(expected);
    }
  });
});

describe('listPacks', () => {
  it('returns array of all pack definitions', () => {
    const packs = listPacks();
    expect(Array.isArray(packs)).toBe(true);
    expect(packs.length).toBeGreaterThanOrEqual(EXPECTED_PACKS.length);
  });

  it('contains all expected packs by name', () => {
    const packs = listPacks();
    const names = packs.map((p) => p.name);
    for (const expected of EXPECTED_PACKS) {
      expect(names, `listPacks missing: ${expected}`).toContain(expected);
    }
  });
});

describe('registry consistency', () => {
  it('every hook referenced in a pack exists in the hooks map', () => {
    const registry = loadRegistry();
    for (const [packName, pack] of Object.entries(registry.packs)) {
      for (const hookName of pack.hooks) {
        expect(
          registry.hooks[hookName],
          `pack '${packName}' references missing hook '${hookName}'`,
        ).toBeDefined();
      }
    }
  });
});

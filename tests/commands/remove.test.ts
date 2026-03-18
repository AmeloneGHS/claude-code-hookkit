import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { _removeAt } from '../../src/commands/remove.js';

let tmp: string;
let settingsPath: string;
let hooksDir: string;
let sourceHooksDir: string;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'claude-hooks-remove-test-'));
  settingsPath = join(tmp, '.claude', 'settings.json');
  hooksDir = join(tmp, '.claude', 'hooks');
  sourceHooksDir = join(tmp, 'registry', 'hooks');

  await mkdir(sourceHooksDir, { recursive: true });
  await mkdir(join(tmp, '.claude'), { recursive: true });
  await mkdir(hooksDir, { recursive: true });
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

/**
 * Helper: set up a "installed" state with the script file present and settings.json
 * containing the hook entry.
 */
async function setupInstalled(hookName: string, scriptFile: string, event: string, matcher?: string): Promise<string> {
  const scriptPath = join(hooksDir, scriptFile);
  await writeFile(scriptPath, '#!/bin/bash\necho "installed"\n', { mode: 0o755 });

  const hookEntry = {
    type: 'command',
    command: scriptPath,
  };
  const group = matcher ? { matcher, hooks: [hookEntry] } : { hooks: [hookEntry] };
  const settings = {
    env: { KEEP_ME: 'yes' },
    hooks: {
      [event]: [group],
    },
  };
  await writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  return scriptPath;
}

describe('_removeAt', () => {
  it('deletes the script file from hooksDir', async () => {
    const scriptPath = await setupInstalled(
      'sensitive-path-guard',
      'sensitive-path-guard.sh',
      'PreToolUse',
      'Edit|Write',
    );

    await _removeAt({
      settingsPath,
      hooksDir,
      hookName: 'sensitive-path-guard',
    });

    expect(existsSync(scriptPath)).toBe(false);
  });

  it('removes the hook entry from settings.json', async () => {
    await setupInstalled(
      'sensitive-path-guard',
      'sensitive-path-guard.sh',
      'PreToolUse',
      'Edit|Write',
    );

    await _removeAt({
      settingsPath,
      hooksDir,
      hookName: 'sensitive-path-guard',
    });

    const raw = await readFile(settingsPath, 'utf8');
    const parsed = JSON.parse(raw);
    // The PreToolUse array should be empty or not contain this hook
    const preToolUse: Array<{ matcher?: string; hooks: Array<{ command: string }> }> =
      parsed.hooks?.['PreToolUse'] ?? [];
    const hasEntry = preToolUse.some((g) =>
      g.hooks.some((h) => h.command.includes('sensitive-path-guard.sh')),
    );
    expect(hasEntry).toBe(false);
  });

  it('preserves non-hook settings keys after removal', async () => {
    await setupInstalled(
      'sensitive-path-guard',
      'sensitive-path-guard.sh',
      'PreToolUse',
      'Edit|Write',
    );

    await _removeAt({
      settingsPath,
      hooksDir,
      hookName: 'sensitive-path-guard',
    });

    const raw = await readFile(settingsPath, 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed.env).toEqual({ KEEP_ME: 'yes' });
  });

  it('returns without throwing when hook is not installed', async () => {
    // No script file, no settings
    await expect(
      _removeAt({
        settingsPath,
        hooksDir,
        hookName: 'sensitive-path-guard',
      }),
    ).resolves.toBeUndefined();
  });

  it('returns without throwing for unknown hook name', async () => {
    await expect(
      _removeAt({
        settingsPath,
        hooksDir,
        hookName: 'nonexistent-hook',
      }),
    ).resolves.toBeUndefined();
  });

  it('with --dry-run does NOT delete the script file', async () => {
    const scriptPath = await setupInstalled(
      'sensitive-path-guard',
      'sensitive-path-guard.sh',
      'PreToolUse',
      'Edit|Write',
    );

    await _removeAt({
      settingsPath,
      hooksDir,
      hookName: 'sensitive-path-guard',
      dryRun: true,
    });

    // Script should still be there
    expect(existsSync(scriptPath)).toBe(true);
  });

  it('with --dry-run does NOT modify settings.json', async () => {
    await setupInstalled(
      'sensitive-path-guard',
      'sensitive-path-guard.sh',
      'PreToolUse',
      'Edit|Write',
    );

    const before = await readFile(settingsPath, 'utf8');

    await _removeAt({
      settingsPath,
      hooksDir,
      hookName: 'sensitive-path-guard',
      dryRun: true,
    });

    const after = await readFile(settingsPath, 'utf8');
    expect(after).toBe(before);
  });

  it('removes only the matching hook, leaving other hooks intact', async () => {
    const scriptPath1 = join(hooksDir, 'sensitive-path-guard.sh');
    const scriptPath2 = join(hooksDir, 'exit-code-enforcer.sh');

    await writeFile(scriptPath1, '#!/bin/bash\necho "guard"\n', { mode: 0o755 });
    await writeFile(scriptPath2, '#!/bin/bash\necho "enforcer"\n', { mode: 0o755 });

    const settings = {
      hooks: {
        PreToolUse: [
          {
            matcher: 'Edit|Write',
            hooks: [{ type: 'command', command: scriptPath1 }],
          },
          {
            matcher: 'Bash',
            hooks: [{ type: 'command', command: scriptPath2 }],
          },
        ],
      },
    };
    await writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8');

    await _removeAt({
      settingsPath,
      hooksDir,
      hookName: 'sensitive-path-guard',
    });

    // Script 1 deleted, script 2 still there
    expect(existsSync(scriptPath1)).toBe(false);
    expect(existsSync(scriptPath2)).toBe(true);

    // Settings should still have exit-code-enforcer entry
    const raw = await readFile(settingsPath, 'utf8');
    const parsed = JSON.parse(raw);
    const preToolUse: Array<{ matcher?: string; hooks: Array<{ command: string }> }> =
      parsed.hooks?.['PreToolUse'] ?? [];
    const hasEnforcer = preToolUse.some((g) =>
      g.hooks.some((h) => h.command.includes('exit-code-enforcer.sh')),
    );
    expect(hasEnforcer).toBe(true);
  });
});

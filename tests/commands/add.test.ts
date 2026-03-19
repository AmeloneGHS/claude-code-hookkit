import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, mkdir, access, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { constants } from 'node:fs';

import { _addAt } from '../../src/commands/add.js';

let tmp: string;
let settingsPath: string;
let hooksDir: string;
let sourceHooksDir: string;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'claude-code-hookkit-add-test-'));
  settingsPath = join(tmp, '.claude', 'settings.json');
  hooksDir = join(tmp, '.claude', 'hooks');
  sourceHooksDir = join(tmp, 'registry', 'hooks');

  // Create source hooks directory with fake scripts
  await mkdir(sourceHooksDir, { recursive: true });
  await mkdir(join(tmp, '.claude'), { recursive: true });
  await mkdir(hooksDir, { recursive: true });

  // Create a fake hook script for testing
  await writeFile(
    join(sourceHooksDir, 'sensitive-path-guard.sh'),
    '#!/bin/bash\necho "sensitive-path-guard"\n',
    'utf8',
  );
  await writeFile(
    join(sourceHooksDir, 'exit-code-enforcer.sh'),
    '#!/bin/bash\necho "exit-code-enforcer"\n',
    'utf8',
  );
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe('_addAt', () => {
  it('copies script file to hooksDir', async () => {
    await _addAt({
      settingsPath,
      hooksDir,
      sourceHooksDir,
      hookName: 'sensitive-path-guard',
    });

    expect(existsSync(join(hooksDir, 'sensitive-path-guard.sh'))).toBe(true);
  });

  it('makes copied script executable (+x)', async () => {
    await _addAt({
      settingsPath,
      hooksDir,
      sourceHooksDir,
      hookName: 'sensitive-path-guard',
    });

    const destPath = join(hooksDir, 'sensitive-path-guard.sh');
    await expect(access(destPath, constants.X_OK)).resolves.toBeUndefined();
  });

  it('adds hook entry to settings.json', async () => {
    await _addAt({
      settingsPath,
      hooksDir,
      sourceHooksDir,
      hookName: 'sensitive-path-guard',
    });

    const raw = await readFile(settingsPath, 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed.hooks).toBeDefined();
    expect(parsed.hooks['PreToolUse']).toBeDefined();

    const groups: Array<{ matcher?: string; hooks: Array<{ type: string; command: string }> }> =
      parsed.hooks['PreToolUse'];
    const hasEntry = groups.some(
      (g) =>
        g.matcher === 'Edit|Write' &&
        g.hooks.some((h) => h.command.includes('sensitive-path-guard.sh')),
    );
    expect(hasEntry).toBe(true);
  });

  it('does not write anything with --dry-run', async () => {
    await _addAt({
      settingsPath,
      hooksDir,
      sourceHooksDir,
      hookName: 'sensitive-path-guard',
      dryRun: true,
    });

    expect(existsSync(join(hooksDir, 'sensitive-path-guard.sh'))).toBe(false);
    expect(existsSync(settingsPath)).toBe(false);
  });

  it('returns without throwing for unknown hook name', async () => {
    // Should not throw — prints error and returns cleanly
    await expect(
      _addAt({
        settingsPath,
        hooksDir,
        sourceHooksDir,
        hookName: 'nonexistent-hook',
      }),
    ).resolves.toBeUndefined();
  });

  it('preserves existing settings when adding a hook', async () => {
    const existing = {
      env: { MY_VAR: 'value' },
      mcpServers: { 'my-server': { command: 'npx', args: ['my-server'] } },
    };
    await writeFile(settingsPath, JSON.stringify(existing, null, 2), 'utf8');

    await _addAt({
      settingsPath,
      hooksDir,
      sourceHooksDir,
      hookName: 'sensitive-path-guard',
    });

    const raw = await readFile(settingsPath, 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed.env).toEqual({ MY_VAR: 'value' });
    expect(parsed.mcpServers).toEqual({ 'my-server': { command: 'npx', args: ['my-server'] } });
    expect(parsed.hooks).toBeDefined();
  });

  it('skips duplicate hook (applyMerge dedup) without error', async () => {
    // Install once
    await _addAt({
      settingsPath,
      hooksDir,
      sourceHooksDir,
      hookName: 'sensitive-path-guard',
    });

    const afterFirst = JSON.parse(await readFile(settingsPath, 'utf8'));
    const countAfterFirst = afterFirst.hooks['PreToolUse'].length;

    // Install again
    await _addAt({
      settingsPath,
      hooksDir,
      sourceHooksDir,
      hookName: 'sensitive-path-guard',
    });

    const afterSecond = JSON.parse(await readFile(settingsPath, 'utf8'));
    const countAfterSecond = afterSecond.hooks['PreToolUse'].length;

    // Should not have doubled
    expect(countAfterSecond).toBe(countAfterFirst);
  });
});

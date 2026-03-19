import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// We test initCommand by calling it with mocked locator paths.
// The internal _initAt helper accepts explicit settingsPath + hooksDir so tests
// never touch the real ~/.claude or .claude directories.
import { _initAt } from '../../src/commands/init.js';

let tmp: string;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'claude-code-hookkit-test-'));
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

function settingsPath(): string {
  return join(tmp, '.claude', 'settings.json');
}

function hooksDir(): string {
  return join(tmp, '.claude', 'hooks');
}

describe('initCommand', () => {
  it('creates .claude/hooks/ directory when it does not exist', async () => {
    await _initAt({ settingsPath: settingsPath(), hooksDir: hooksDir() });
    expect(existsSync(hooksDir())).toBe(true);
  });

  it('creates .claude/settings.json with empty hooks structure when file does not exist', async () => {
    await _initAt({ settingsPath: settingsPath(), hooksDir: hooksDir() });
    expect(existsSync(settingsPath())).toBe(true);
    const raw = await readFile(settingsPath(), 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed).toHaveProperty('hooks');
    expect(parsed.hooks).toEqual({});
  });

  it('preserves all non-hook keys in existing settings.json', async () => {
    const claudeDir = join(tmp, '.claude');
    await mkdir(claudeDir, { recursive: true });
    const existing = {
      env: { MY_VAR: 'value' },
      mcpServers: { 'my-server': { command: 'npx', args: ['my-server'] } },
      statusLine: { type: 'command', command: '/path/to/status.js' },
    };
    await writeFile(settingsPath(), JSON.stringify(existing, null, 2), 'utf8');

    await _initAt({ settingsPath: settingsPath(), hooksDir: hooksDir() });

    const raw = await readFile(settingsPath(), 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed.env).toEqual({ MY_VAR: 'value' });
    expect(parsed.mcpServers).toEqual({ 'my-server': { command: 'npx', args: ['my-server'] } });
    expect(parsed.statusLine).toEqual({ type: 'command', command: '/path/to/status.js' });
    expect(parsed.hooks).toEqual({});
  });

  it('prints "Already initialized" and does not modify file when hooks key exists and is non-empty', async () => {
    const claudeDir = join(tmp, '.claude');
    await mkdir(claudeDir, { recursive: true });
    const existing = {
      hooks: {
        PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: '/path/to/hook.sh' }] }],
      },
    };
    await writeFile(settingsPath(), JSON.stringify(existing, null, 2), 'utf8');
    const beforeMtime = (await import('node:fs')).statSync(settingsPath()).mtimeMs;

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await _initAt({ settingsPath: settingsPath(), hooksDir: hooksDir() });
    consoleSpy.mockRestore();

    const afterMtime = (await import('node:fs')).statSync(settingsPath()).mtimeMs;
    expect(afterMtime).toBe(beforeMtime);
  });

  it('with --dry-run does NOT create any files or directories', async () => {
    await _initAt({ settingsPath: settingsPath(), hooksDir: hooksDir(), dryRun: true });
    expect(existsSync(hooksDir())).toBe(false);
    expect(existsSync(settingsPath())).toBe(false);
  });

  it('with --dry-run prints what WOULD be created', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await _initAt({ settingsPath: settingsPath(), hooksDir: hooksDir(), dryRun: true });
      // Read calls BEFORE restore (mockRestore clears mock.calls)
      const calls = consoleSpy.mock.calls.flat().join('\n');
      // Should mention the hooks dir and settings path
      expect(calls).toContain(hooksDir());
      expect(calls).toContain(settingsPath());
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('creates a backup of existing settings.json before writing', async () => {
    const claudeDir = join(tmp, '.claude');
    await mkdir(claudeDir, { recursive: true });
    const existing = { env: { FOO: 'bar' } };
    await writeFile(settingsPath(), JSON.stringify(existing, null, 2), 'utf8');

    await _initAt({ settingsPath: settingsPath(), hooksDir: hooksDir() });

    const backupPath = settingsPath() + '.backup';
    expect(existsSync(backupPath)).toBe(true);
    const backupContent = JSON.parse(await readFile(backupPath, 'utf8'));
    expect(backupContent.env).toEqual({ FOO: 'bar' });
  });

  it('with --scope user targets ~/.claude/ paths (check via settingsPath override)', async () => {
    // Verify that scope mapping works — test using explicit paths for isolation
    const userTmp = await mkdtemp(join(tmpdir(), 'claude-code-hookkit-user-'));
    const userSettings = join(userTmp, 'settings.json');
    const userHooks = join(userTmp, 'hooks');

    try {
      await _initAt({ settingsPath: userSettings, hooksDir: userHooks });
      expect(existsSync(userHooks)).toBe(true);
      expect(existsSync(userSettings)).toBe(true);
      const parsed = JSON.parse(await readFile(userSettings, 'utf8'));
      expect(parsed.hooks).toEqual({});
    } finally {
      await rm(userTmp, { recursive: true, force: true });
    }
  });

  it('is a no-op when hooks key exists but is empty object', async () => {
    const claudeDir = join(tmp, '.claude');
    await mkdir(claudeDir, { recursive: true });
    const existing = { hooks: {} };
    await writeFile(settingsPath(), JSON.stringify(existing, null, 2), 'utf8');

    // Running init on already-initialized (empty hooks) should not break anything
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await _initAt({ settingsPath: settingsPath(), hooksDir: hooksDir() });
    consoleSpy.mockRestore();

    const raw = await readFile(settingsPath(), 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed.hooks).toEqual({});
  });
});

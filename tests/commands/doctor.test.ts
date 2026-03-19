import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { _doctorAt } from '../../src/commands/doctor.js';

let tmp: string;
let settingsPath: string;
let hooksDir: string;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'claude-code-hookkit-doctor-test-'));
  settingsPath = join(tmp, '.claude', 'settings.json');
  hooksDir = join(tmp, '.claude', 'hooks');
  await mkdir(join(tmp, '.claude'), { recursive: true });
  await mkdir(hooksDir, { recursive: true });
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

/**
 * Create a minimal settings.json with a hook entry pointing to a given script path.
 */
async function writeSettings(hooks: Record<string, unknown>): Promise<void> {
  await writeFile(settingsPath, JSON.stringify({ hooks }, null, 2), 'utf8');
}

/**
 * Create a script file in hooksDir, optionally with execute bit.
 */
async function createScript(name: string, executable = true): Promise<string> {
  const scriptPath = join(hooksDir, name);
  await writeFile(scriptPath, '#!/bin/bash\necho "hook"\n', 'utf8');
  if (executable) {
    await chmod(scriptPath, 0o755);
  } else {
    await chmod(scriptPath, 0o644);
  }
  return scriptPath;
}

describe('_doctorAt', () => {
  it('returns all pass for clean setup', async () => {
    const scriptPath = await createScript('sensitive-path-guard.sh');
    await writeSettings({
      PreToolUse: [
        { matcher: 'Edit|Write', hooks: [{ type: 'command', command: scriptPath }] },
      ],
    });

    const result = await _doctorAt({ settingsPath, hooksDir });

    expect(result.failed).toBe(0);
    expect(result.warnings).toBe(0);
    expect(result.passed).toBeGreaterThan(0);
  });

  it('reports WARN when settings file does not exist', async () => {
    // No settings file written — hooksDir exists but empty
    const result = await _doctorAt({ settingsPath, hooksDir });

    expect(result.checks.some((c) => c.level === 'warn' && /settings/i.test(c.message))).toBe(true);
  });

  it('reports FAIL for malformed settings JSON', async () => {
    await writeFile(settingsPath, '{ invalid json }', 'utf8');

    const result = await _doctorAt({ settingsPath, hooksDir });

    expect(result.failed).toBeGreaterThan(0);
    expect(result.checks.some((c) => c.level === 'fail' && /parse|json|malformed/i.test(c.message))).toBe(true);
  });

  it('reports FAIL when script file is missing', async () => {
    const missingPath = join(hooksDir, 'nonexistent.sh');
    await writeSettings({
      PreToolUse: [
        { matcher: 'Edit|Write', hooks: [{ type: 'command', command: missingPath }] },
      ],
    });

    const result = await _doctorAt({ settingsPath, hooksDir });

    expect(result.failed).toBeGreaterThan(0);
    expect(result.checks.some((c) => c.level === 'fail' && /not found|missing/i.test(c.message))).toBe(true);
  });

  it('reports FAIL when script is not executable', async () => {
    const scriptPath = await createScript('my-hook.sh', false);
    await writeSettings({
      PostToolUse: [
        { hooks: [{ type: 'command', command: scriptPath }] },
      ],
    });

    const result = await _doctorAt({ settingsPath, hooksDir });

    expect(result.failed).toBeGreaterThan(0);
    expect(result.checks.some((c) => c.level === 'fail' && /not executable|executable/i.test(c.message))).toBe(true);
  });

  it('reports no orphaned entries when scripts exist', async () => {
    const scriptPath = await createScript('good-hook.sh');
    await writeSettings({
      PreToolUse: [{ hooks: [{ type: 'command', command: scriptPath }] }],
    });

    const result = await _doctorAt({ settingsPath, hooksDir });

    expect(result.checks.some((c) => /orphan/i.test(c.message) && c.level === 'fail')).toBe(false);
  });

  it('reports WARN for conflicting hooks (same event+matcher, different commands)', async () => {
    const scriptA = await createScript('hook-a.sh');
    const scriptB = await createScript('hook-b.sh');
    await writeSettings({
      PreToolUse: [
        { matcher: 'Edit|Write', hooks: [{ type: 'command', command: scriptA }] },
        { matcher: 'Edit|Write', hooks: [{ type: 'command', command: scriptB }] },
      ],
    });

    const result = await _doctorAt({ settingsPath, hooksDir });

    expect(result.checks.some((c) => c.level === 'warn' && /conflict/i.test(c.message))).toBe(true);
  });

  it('reports clean state when no hooks are installed', async () => {
    await writeSettings({});

    const result = await _doctorAt({ settingsPath, hooksDir });

    expect(result.failed).toBe(0);
    // Could have warnings (e.g., conflicts check passes with zero hooks)
    expect(result.checks.length).toBeGreaterThan(0);
  });

  it('returns exitCode 1 when any check fails', async () => {
    await writeFile(settingsPath, '{ bad json }', 'utf8');

    const result = await _doctorAt({ settingsPath, hooksDir });

    expect(result.exitCode).toBe(1);
  });

  it('returns exitCode 0 when only PASS and WARN', async () => {
    const scriptPath = await createScript('my-hook.sh');
    await writeSettings({
      PreToolUse: [{ hooks: [{ type: 'command', command: scriptPath }] }],
    });

    const result = await _doctorAt({ settingsPath, hooksDir });

    expect(result.exitCode).toBe(0);
  });

  it('reports FAIL when hooksDir does not exist', async () => {
    await rm(hooksDir, { recursive: true, force: true });
    await writeSettings({});

    const result = await _doctorAt({ settingsPath, hooksDir });

    expect(result.checks.some((c) => c.level === 'fail' && /hooks dir/i.test(c.message))).toBe(true);
  });
});

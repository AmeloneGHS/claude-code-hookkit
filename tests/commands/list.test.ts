import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { _listAt } from '../../src/commands/list.js';

let tmp: string;
let hooksDir: string;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'claude-hooks-list-test-'));
  hooksDir = join(tmp, '.claude', 'hooks');
  await mkdir(hooksDir, { recursive: true });
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe('_listAt', () => {
  it('prints a header row with expected columns', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await _listAt({ hooksDir });
      const output = logSpy.mock.calls.flat().join('\n');
      expect(output).toContain('Name');
      expect(output).toContain('Event');
      expect(output).toContain('Pack');
      expect(output).toContain('Installed');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('shows all 7 hooks from the registry', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await _listAt({ hooksDir });
      const output = logSpy.mock.calls.flat().join('\n');
      expect(output).toContain('sensitive-path-guard');
      expect(output).toContain('exit-code-enforcer');
      expect(output).toContain('post-edit-lint');
      expect(output).toContain('ts-check');
      expect(output).toContain('web-budget-gate');
      expect(output).toContain('cost-tracker');
      expect(output).toContain('error-advisor');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('shows "no" for hooks when none are installed', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await _listAt({ hooksDir });
      const output = logSpy.mock.calls.flat().join('\n');
      // Should contain "no" for uninstalled hooks (case insensitive)
      expect(output.toLowerCase()).toContain('no');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('shows "yes" for installed hooks', async () => {
    // Create a script file to simulate installed hook
    await writeFile(join(hooksDir, 'sensitive-path-guard.sh'), '#!/bin/bash\n', { mode: 0o755 });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await _listAt({ hooksDir });
      const output = logSpy.mock.calls.flat().join('\n');
      expect(output.toLowerCase()).toContain('yes');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('shows mixed yes/no when some hooks are installed', async () => {
    // Install only one hook
    await writeFile(join(hooksDir, 'sensitive-path-guard.sh'), '#!/bin/bash\n', { mode: 0o755 });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await _listAt({ hooksDir });
      const output = logSpy.mock.calls.flat().join('\n');
      expect(output.toLowerCase()).toContain('yes');
      expect(output.toLowerCase()).toContain('no');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('shows pack names in output', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await _listAt({ hooksDir });
      const output = logSpy.mock.calls.flat().join('\n');
      expect(output).toContain('security-pack');
      expect(output).toContain('quality-pack');
      expect(output).toContain('cost-pack');
      expect(output).toContain('error-pack');
    } finally {
      logSpy.mockRestore();
    }
  });
});

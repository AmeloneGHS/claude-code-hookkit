import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, access, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { constants } from 'node:fs';

import { getTemplate, listTemplateEvents } from '../../src/templates/index.js';
import { _createAt } from '../../src/commands/create.js';

let tmp: string;
let hooksDir: string;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'claude-hooks-create-test-'));
  hooksDir = join(tmp, '.claude', 'hooks');
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Template registry tests
// ---------------------------------------------------------------------------

describe('listTemplateEvents', () => {
  it('returns the four supported event types', () => {
    const events = listTemplateEvents();
    expect(events).toEqual(['PreToolUse', 'PostToolUse', 'SessionStart', 'Stop']);
  });
});

describe('getTemplate', () => {
  it('every template starts with bash shebang', () => {
    for (const event of listTemplateEvents()) {
      const script = getTemplate(event, 'my-hook');
      expect(script).toMatch(/^#!\/usr\/bin\/env bash/);
    }
  });

  it('every template reads stdin', () => {
    for (const event of listTemplateEvents()) {
      const script = getTemplate(event, 'my-hook');
      expect(script).toContain('INPUT=$(cat)');
    }
  });

  it('every template has TODO placeholder comment', () => {
    for (const event of listTemplateEvents()) {
      const script = getTemplate(event, 'my-hook');
      expect(script).toContain('# TODO:');
    }
  });

  it('every template ends with exit 0', () => {
    for (const event of listTemplateEvents()) {
      const script = getTemplate(event, 'my-hook');
      expect(script).toContain('exit 0');
    }
  });

  it('every template uses grep-based JSON parsing (no jq)', () => {
    for (const event of listTemplateEvents()) {
      const script = getTemplate(event, 'my-hook');
      expect(script).toContain('grep -o');
      expect(script).not.toContain('jq');
    }
  });

  it('interpolates hook name into header comment', () => {
    const script = getTemplate('PreToolUse', 'my-guard');
    expect(script).toContain('my-guard');
  });

  it('interpolates matcher into PreToolUse header when provided', () => {
    const script = getTemplate('PreToolUse', 'my-guard', 'Bash');
    expect(script).toContain('Bash');
  });

  it('PreToolUse template extracts tool_name and includes exit 2 pattern', () => {
    const script = getTemplate('PreToolUse', 'my-guard');
    expect(script).toContain('TOOL_NAME=');
    expect(script).toContain('exit 2');
  });

  it('PostToolUse template extracts tool_response', () => {
    const script = getTemplate('PostToolUse', 'my-hook');
    expect(script).toContain('TOOL_RESPONSE=');
  });

  it('PostToolUse template notes it should always exit 0', () => {
    const script = getTemplate('PostToolUse', 'my-hook');
    expect(script).toContain('always exit 0');
  });

  it('SessionStart template extracts session_id and cwd', () => {
    const script = getTemplate('SessionStart', 'my-hook');
    expect(script).toContain('SESSION_ID=');
    expect(script).toContain('CWD=');
  });

  it('Stop template extracts session_id', () => {
    const script = getTemplate('Stop', 'my-hook');
    expect(script).toContain('SESSION_ID=');
  });

  it('returns generic fallback for unknown event types', () => {
    const script = getTemplate('UnknownEvent', 'my-hook');
    expect(script).toMatch(/^#!\/usr\/bin\/env bash/);
    expect(script).toContain('INPUT=$(cat)');
    expect(script).toContain('exit 0');
  });
});

// ---------------------------------------------------------------------------
// Create command tests
// ---------------------------------------------------------------------------

describe('_createAt', () => {
  it('creates the hook script file', async () => {
    await _createAt({ name: 'my-guard', event: 'PreToolUse', matcher: 'Bash', hooksDir });
    await access(join(hooksDir, 'my-guard.sh'), constants.F_OK);
  });

  it('created script has executable bit set', async () => {
    await _createAt({ name: 'my-guard', event: 'PreToolUse', hooksDir });
    const s = await stat(join(hooksDir, 'my-guard.sh'));
    // Check owner execute bit (0o100)
    expect(s.mode & 0o111).toBeGreaterThan(0);
  });

  it('script content matches template for event type', async () => {
    await _createAt({ name: 'my-guard', event: 'PreToolUse', matcher: 'Bash', hooksDir });
    const content = await readFile(join(hooksDir, 'my-guard.sh'), 'utf8');
    expect(content).toMatch(/^#!\/usr\/bin\/env bash/);
    expect(content).toContain('my-guard');
    expect(content).toContain('Bash');
    expect(content).toContain('exit 0');
  });

  it('creates fixtures directory', async () => {
    await _createAt({ name: 'my-guard', event: 'PreToolUse', hooksDir });
    await access(join(hooksDir, 'fixtures', 'my-guard'), constants.F_OK);
  });

  it('creates allow-example.json fixture for all event types', async () => {
    for (const event of listTemplateEvents()) {
      const hookName = `test-${event.toLowerCase()}`;
      await _createAt({ name: hookName, event, hooksDir });
      const fixturePath = join(hooksDir, 'fixtures', hookName, 'allow-example.json');
      await access(fixturePath, constants.F_OK);
      const content = JSON.parse(await readFile(fixturePath, 'utf8'));
      expect(content).toHaveProperty('description');
      expect(content).toHaveProperty('input');
      expect(content).toHaveProperty('expectedExitCode', 0);
    }
  });

  it('creates block-example.json fixture for PreToolUse', async () => {
    await _createAt({ name: 'my-guard', event: 'PreToolUse', hooksDir });
    const fixturePath = join(hooksDir, 'fixtures', 'my-guard', 'block-example.json');
    await access(fixturePath, constants.F_OK);
    const content = JSON.parse(await readFile(fixturePath, 'utf8'));
    expect(content).toHaveProperty('expectedExitCode', 2);
  });

  it('does NOT create block-example.json for non-blocking events', async () => {
    for (const event of ['PostToolUse', 'SessionStart', 'Stop']) {
      const hookName = `test-nb-${event.toLowerCase()}`;
      await _createAt({ name: hookName, event, hooksDir });
      const blockFixture = join(hooksDir, 'fixtures', hookName, 'block-example.json');
      try {
        await access(blockFixture, constants.F_OK);
        // Should not exist — fail if we reach here
        expect(true).toBe(false);
      } catch {
        // Expected: file does not exist
      }
    }
  });

  it('refuses to overwrite an existing hook', async () => {
    await _createAt({ name: 'my-guard', event: 'PreToolUse', hooksDir });
    const result = await _createAt({ name: 'my-guard', event: 'PreToolUse', hooksDir });
    expect(result).toEqual({ skipped: true });
  });

  it('validates name format — rejects invalid names', async () => {
    const result = await _createAt({ name: 'My Guard!', event: 'PreToolUse', hooksDir });
    expect(result).toEqual({ invalidName: true });
  });

  it('validates event type — rejects unsupported events', async () => {
    const result = await _createAt({ name: 'my-hook', event: 'FakeEvent', hooksDir });
    expect(result).toEqual({ invalidEvent: true });
  });

  it('accepts valid kebab-case names', async () => {
    const result = await _createAt({ name: 'my-guard-v2', event: 'Stop', hooksDir });
    expect(result).not.toHaveProperty('invalidName');
  });
});

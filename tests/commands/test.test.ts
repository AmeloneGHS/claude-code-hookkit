import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// We import the testable internals — testCommand itself is async and uses process.exitCode
import { runFixture, discoverFixtures } from '../../src/commands/test.js';

let tmp: string;
let hooksDir: string;
let fixturesDir: string;

// A simple bash script that exits 0 for "allow" input, exit 2 for "block" input
const ALLOW_BLOCK_SCRIPT = `#!/usr/bin/env bash
INPUT=$(cat)
DECISION=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('decision','allow'))" 2>/dev/null || echo "allow")
if [ "$DECISION" = "block" ]; then
  exit 2
fi
exit 0
`;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'claude-hooks-test-runner-'));
  hooksDir = join(tmp, 'hooks');
  fixturesDir = join(tmp, 'fixtures');
  await mkdir(hooksDir, { recursive: true });
  await mkdir(fixturesDir, { recursive: true });
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

// ─── discoverFixtures ────────────────────────────────────────────────────────

describe('discoverFixtures', () => {
  it('returns empty array when fixture directory does not exist', async () => {
    const results = await discoverFixtures('/nonexistent/path/fixtures/some-hook');
    expect(results).toEqual([]);
  });

  it('discovers JSON files in the fixture directory', async () => {
    const hookFixturesDir = join(fixturesDir, 'my-hook');
    await mkdir(hookFixturesDir, { recursive: true });
    await writeFile(
      join(hookFixturesDir, 'allow.json'),
      JSON.stringify({ description: 'allow case', input: {}, expectedExitCode: 0 }),
    );
    await writeFile(
      join(hookFixturesDir, 'block.json'),
      JSON.stringify({ description: 'block case', input: { decision: 'block' }, expectedExitCode: 2 }),
    );

    const results = await discoverFixtures(hookFixturesDir);
    expect(results).toHaveLength(2);
    const descs = results.map((f) => f.description).sort();
    expect(descs).toContain('allow case');
    expect(descs).toContain('block case');
  });

  it('ignores non-JSON files in fixture directory', async () => {
    const hookFixturesDir = join(fixturesDir, 'my-hook');
    await mkdir(hookFixturesDir, { recursive: true });
    await writeFile(join(hookFixturesDir, 'allow.json'), JSON.stringify({ description: 'a', input: {}, expectedExitCode: 0 }));
    await writeFile(join(hookFixturesDir, 'README.md'), '# notes');
    await writeFile(join(hookFixturesDir, 'helper.sh'), '#!/bin/bash');

    const results = await discoverFixtures(hookFixturesDir);
    expect(results).toHaveLength(1);
    expect(results[0].description).toBe('a');
  });

  it('returns fixture objects with required fields', async () => {
    const hookFixturesDir = join(fixturesDir, 'typed-hook');
    await mkdir(hookFixturesDir, { recursive: true });
    await writeFile(
      join(hookFixturesDir, 'test.json'),
      JSON.stringify({ description: 'typed test', input: { foo: 'bar' }, expectedExitCode: 0, env: { MY_VAR: '1' } }),
    );

    const results = await discoverFixtures(hookFixturesDir);
    expect(results).toHaveLength(1);
    const f = results[0];
    expect(f.description).toBe('typed test');
    expect(f.input).toEqual({ foo: 'bar' });
    expect(f.expectedExitCode).toBe(0);
    expect(f.env).toEqual({ MY_VAR: '1' });
  });
});

// ─── runFixture ──────────────────────────────────────────────────────────────

describe('runFixture', () => {
  let scriptPath: string;

  beforeEach(async () => {
    scriptPath = join(hooksDir, 'test-hook.sh');
    await writeFile(scriptPath, ALLOW_BLOCK_SCRIPT, { mode: 0o755 });
  });

  it('returns passed=true when exit code matches expectedExitCode 0', async () => {
    const result = await runFixture(scriptPath, {
      description: 'allows good input',
      input: { decision: 'allow' },
      expectedExitCode: 0,
    });

    expect(result.passed).toBe(true);
    expect(result.actualExitCode).toBe(0);
    expect(result.expectedExitCode).toBe(0);
    expect(result.description).toBe('allows good input');
  });

  it('returns passed=true when exit code matches expectedExitCode 2', async () => {
    const result = await runFixture(scriptPath, {
      description: 'blocks bad input',
      input: { decision: 'block' },
      expectedExitCode: 2,
    });

    expect(result.passed).toBe(true);
    expect(result.actualExitCode).toBe(2);
    expect(result.expectedExitCode).toBe(2);
  });

  it('returns passed=false when exit code does not match expected', async () => {
    const result = await runFixture(scriptPath, {
      description: 'wrong expectation',
      input: { decision: 'allow' },
      expectedExitCode: 2, // expects block, gets allow
    });

    expect(result.passed).toBe(false);
    expect(result.actualExitCode).toBe(0);
    expect(result.expectedExitCode).toBe(2);
  });

  it('feeds fixture input as JSON on stdin', async () => {
    // Script that reads stdin and exits 0 only if it can parse valid JSON
    const jsonCheckScript = join(hooksDir, 'json-check.sh');
    await writeFile(
      jsonCheckScript,
      `#!/usr/bin/env bash
INPUT=$(cat)
if echo "$INPUT" | python3 -m json.tool > /dev/null 2>&1; then
  exit 0
else
  exit 2
fi
`,
      { mode: 0o755 },
    );

    const result = await runFixture(jsonCheckScript, {
      description: 'feeds valid JSON',
      input: { tool_input: { file_path: 'src/app.ts' } },
      expectedExitCode: 0,
    });

    expect(result.passed).toBe(true);
  });

  it('passes env vars to the spawned script', async () => {
    const envScript = join(hooksDir, 'env-check.sh');
    await writeFile(
      envScript,
      `#!/usr/bin/env bash
cat > /dev/null
if [ "$TEST_ENV_VAR" = "expected_value" ]; then
  exit 0
else
  exit 2
fi
`,
      { mode: 0o755 },
    );

    const result = await runFixture(
      envScript,
      {
        description: 'env var passed',
        input: {},
        expectedExitCode: 0,
        env: { TEST_ENV_VAR: 'expected_value' },
      },
    );

    expect(result.passed).toBe(true);
  });

  it('captures stdout and stderr in result', async () => {
    const outputScript = join(hooksDir, 'output.sh');
    await writeFile(
      outputScript,
      `#!/usr/bin/env bash
cat > /dev/null
echo "stdout message"
echo "stderr message" >&2
exit 0
`,
      { mode: 0o755 },
    );

    const result = await runFixture(outputScript, {
      description: 'captures output',
      input: {},
      expectedExitCode: 0,
    });

    expect(result.stdout).toContain('stdout message');
    expect(result.stderr).toContain('stderr message');
  });

  it('includes hookName in result when provided', async () => {
    const result = await runFixture(
      scriptPath,
      { description: 'named fixture', input: {}, expectedExitCode: 0 },
      { hookName: 'my-hook' },
    );

    expect(result.hookName).toBe('my-hook');
  });

  it('returns passed=false when script does not exist', async () => {
    const result = await runFixture('/nonexistent/script.sh', {
      description: 'missing script',
      input: {},
      expectedExitCode: 0,
    });

    // bash exits 127 when the script file is not found
    expect(result.passed).toBe(false);
    expect(result.actualExitCode).not.toBe(0);
  });
});

// ─── output format checks (integration-style) ────────────────────────────────

describe('testCommand output formatting', () => {
  it('PASS/FAIL output format test (manual verification note)', () => {
    // This verifies the exported constants/helpers exist as a smoke check.
    // Full output formatting is integration-tested via CLI smoke test.
    expect(typeof runFixture).toBe('function');
    expect(typeof discoverFixtures).toBe('function');
  });
});

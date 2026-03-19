import { spawnSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import pc from 'picocolors';
import { getHook, listHooks } from '../registry/index.js';
import { getHooksDir } from '../config/locator.js';

// Resolve the package root (two levels up from src/commands/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PACKAGE_ROOT = resolve(__dirname, '..', '..');
const BUNDLED_HOOKS_DIR = join(PACKAGE_ROOT, 'registry', 'hooks');
const BUNDLED_FIXTURES_DIR = join(PACKAGE_ROOT, 'registry', 'hooks', 'fixtures');

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Fixture {
  description: string;
  input: Record<string, unknown>;
  expectedExitCode: number;
  env?: Record<string, string>;
}

export interface TestResult {
  hookName: string;
  description: string;
  expectedExitCode: number;
  actualExitCode: number;
  passed: boolean;
  stdout: string;
  stderr: string;
}

export interface TestSummary {
  passed: number;
  failed: number;
  results: TestResult[];
}

export interface RunFixtureOptions {
  hookName?: string;
}

// ─── Core engine (exported for unit testing) ─────────────────────────────────

/**
 * Discover fixture JSON files in a directory.
 * Returns an empty array if the directory does not exist.
 */
export async function discoverFixtures(fixtureDir: string): Promise<Fixture[]> {
  if (!existsSync(fixtureDir)) {
    return [];
  }

  let entries: string[];
  try {
    entries = await readdir(fixtureDir);
  } catch {
    return [];
  }

  const fixtures: Fixture[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const filePath = join(fixtureDir, entry);
    try {
      const raw = await readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw) as Fixture;
      fixtures.push(parsed);
    } catch {
      // Skip malformed fixture files
    }
  }
  return fixtures;
}

/**
 * Run a single fixture against a hook script.
 * Spawns `bash <scriptPath>` with fixture.input as JSON on stdin.
 * Compares the actual exit code to fixture.expectedExitCode.
 */
export async function runFixture(
  scriptPath: string,
  fixture: Fixture,
  opts: RunFixtureOptions = {},
): Promise<TestResult> {
  const hookName = opts.hookName ?? '';
  const input = JSON.stringify(fixture.input);

  const result = spawnSync('bash', [scriptPath], {
    input,
    encoding: 'utf8',
    env: { ...process.env, ...(fixture.env ?? {}) },
  });

  const actualExitCode = result.status ?? -1;
  const passed = actualExitCode === fixture.expectedExitCode;

  return {
    hookName,
    description: fixture.description,
    expectedExitCode: fixture.expectedExitCode,
    actualExitCode,
    passed,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

// ─── Script path resolution ──────────────────────────────────────────────────

/**
 * Resolve the absolute path to a bundled hook script.
 */
function resolveBundledScriptPath(scriptFile: string): string {
  return join(BUNDLED_HOOKS_DIR, scriptFile);
}

// ─── Single hook test ────────────────────────────────────────────────────────

async function testHook(
  hookName: string,
  scope: string,
): Promise<TestResult[]> {
  const def = getHook(hookName);
  if (!def) {
    console.error(pc.red(`Hook not found in registry: ${hookName}`));
    console.error(pc.dim('  Run `claude-hooks list` to see available hooks'));
    process.exitCode = 1;
    return [];
  }

  const scriptPath = resolveBundledScriptPath(def.scriptFile);

  // Discover fixtures: bundled first, then user fixtures dir
  const bundledFixtureDir = join(BUNDLED_FIXTURES_DIR, hookName);
  const userHooksDir = getHooksDir(scope as 'user' | 'project' | 'local');
  const userFixtureDir = join(userHooksDir, 'fixtures', hookName);

  const bundledFixtures = await discoverFixtures(bundledFixtureDir);
  const userFixtures = await discoverFixtures(userFixtureDir);
  const allFixtures = [...bundledFixtures, ...userFixtures];

  if (allFixtures.length === 0) {
    console.log(pc.yellow(`  warning`) + `  ${hookName}: no fixtures found`);
    console.log(pc.dim(`    Add fixtures at: registry/hooks/fixtures/${hookName}/*.json`));
    return [];
  }

  const results: TestResult[] = [];
  for (const fixture of allFixtures) {
    const result = await runFixture(scriptPath, fixture, { hookName });
    results.push(result);
    printResult(result);
  }
  return results;
}

// ─── Output helpers ──────────────────────────────────────────────────────────

function printResult(result: TestResult): void {
  if (result.passed) {
    const label = pc.green('  PASS');
    const name = pc.bold(result.hookName);
    console.log(`${label}  ${name}: ${result.description}`);
  } else {
    const label = pc.red('  FAIL');
    const name = pc.bold(result.hookName);
    const detail = pc.dim(`(expected ${result.expectedExitCode}, got ${result.actualExitCode})`);
    console.log(`${label}  ${name}: ${result.description} ${detail}`);
  }
}

function printSummary(summary: TestSummary): void {
  const { passed, failed } = summary;
  const passStr = pc.green(`${passed} passed`);
  const failStr = failed > 0 ? pc.red(`${failed} failed`) : pc.dim(`${failed} failed`);
  console.log(`\n${passStr}, ${failStr}`);
}

// ─── testCommand (CLI entry point) ──────────────────────────────────────────

export interface TestCommandOpts {
  hookName?: string;
  all?: boolean;
  scope?: string;
}

export async function testCommand(opts: TestCommandOpts): Promise<TestSummary> {
  const scope = opts.scope ?? 'project';
  const allResults: TestResult[] = [];

  if (opts.all) {
    // Test all bundled hooks
    const allHooks = listHooks();
    for (const def of allHooks) {
      console.log(pc.bold(`\n${def.name}`));
      const results = await testHook(def.name, scope);
      allResults.push(...results);
    }
  } else if (opts.hookName) {
    console.log(pc.bold(`\n${opts.hookName}`));
    const results = await testHook(opts.hookName, scope);
    allResults.push(...results);
  } else {
    console.error(pc.red('Error: specify a hook name or use --all'));
    process.exitCode = 1;
    return { passed: 0, failed: 0, results: [] };
  }

  const passed = allResults.filter((r) => r.passed).length;
  const failed = allResults.filter((r) => !r.passed).length;

  const summary: TestSummary = { passed, failed, results: allResults };
  printSummary(summary);

  if (failed > 0) {
    process.exitCode = 1;
  }

  return summary;
}

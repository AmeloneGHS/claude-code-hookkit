import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import pc from 'picocolors';
import { getHook } from '../registry/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Find the registry/hooks/fixtures/<hookName>/ directory by walking up from __dirname.
 * Works from both src/commands/ (dev) and dist/ (built) layouts.
 */
function fixturesDir(hookName: string): string {
  let dir = __dirname;
  for (let i = 0; i < 4; i++) {
    const candidate = join(dir, 'registry', 'hooks', 'fixtures', hookName);
    if (existsSync(candidate)) return candidate;
    const parent = join(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  // Return best-guess path (will not exist, caller handles gracefully)
  return join(__dirname, '..', 'registry', 'hooks', 'fixtures', hookName);
}

/**
 * Load all fixture JSON files for a hook.
 * Returns an array of parsed fixture objects (or empty if none found).
 */
async function loadFixtures(hookName: string): Promise<Array<{ description: string; input: unknown; expectedExitCode: number }>> {
  const dir = fixturesDir(hookName);
  if (!existsSync(dir)) return [];

  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  const jsonFiles = files.filter(f => f.endsWith('.json')).sort();
  const fixtures: Array<{ description: string; input: unknown; expectedExitCode: number }> = [];

  for (const file of jsonFiles) {
    try {
      const raw = await readFile(join(dir, file), 'utf8');
      const parsed = JSON.parse(raw) as { description: string; input: unknown; expectedExitCode: number };
      fixtures.push(parsed);
    } catch {
      // Skip malformed fixture files
    }
  }

  return fixtures;
}

interface InfoOptions {
  hookName: string;
}

/**
 * Print detailed information about a bundled hook.
 * Shows name, description, event, matcher, pack, and example fixture input/output.
 */
export async function infoCommand(opts: InfoOptions): Promise<void> {
  const { hookName } = opts;

  const hook = getHook(hookName);
  if (!hook) {
    console.error(pc.red(`Hook "${hookName}" not found in registry.`));
    console.error(pc.dim('Run `claude-code-hookkit list` to see all available hooks.'));
    process.exit(1);
  }

  // Header
  console.log('');
  console.log(pc.bold(pc.cyan(`${hook.name}`)));
  console.log(pc.dim('─'.repeat(50)));

  // Core metadata
  console.log(`${pc.bold('Description:')} ${hook.description}`);
  console.log(`${pc.bold('Event:')}       ${pc.yellow(hook.event)}`);
  console.log(`${pc.bold('Matcher:')}     ${hook.matcher ?? pc.dim('(all tools)')}`);
  console.log(`${pc.bold('Pack:')}        ${pc.cyan(hook.pack ?? pc.dim('(standalone)'))}`);
  console.log(`${pc.bold('Script:')}      ${hook.scriptFile}`);

  // Load and display fixtures
  const fixtures = await loadFixtures(hookName);

  if (fixtures.length === 0) {
    console.log('');
    console.log(pc.dim('No example fixtures found.'));
  } else {
    console.log('');
    console.log(pc.bold('Examples:'));
    console.log('');

    for (const fixture of fixtures) {
      const exitLabel = fixture.expectedExitCode === 0
        ? pc.green(`exit ${fixture.expectedExitCode} (allow)`)
        : pc.red(`exit ${fixture.expectedExitCode} (block)`);

      console.log(`  ${pc.bold(fixture.description)}`);
      console.log(`  ${pc.dim('Input:')}    ${JSON.stringify(fixture.input)}`);
      console.log(`  ${pc.dim('Outcome:')}  ${exitLabel}`);
      console.log('');
    }
  }

  // Usage hint
  console.log(pc.dim(`Install with: claude-code-hookkit add ${hookName}`));
  console.log(pc.dim(`Test with:    claude-code-hookkit test ${hookName}`));
  console.log('');
}

import { mkdirSync, writeFileSync, chmodSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getHooksDir, type Scope } from '../config/locator.js';
import { getTemplate, listTemplateEvents } from '../templates/index.js';
import { log } from '../utils/logger.js';

export interface CreateOptions {
  name: string;
  event: string;
  matcher?: string;
  scope?: string;
}

/** Internal result type used by tests */
export interface CreateResult {
  skipped?: true;
  invalidName?: true;
  invalidEvent?: true;
  created?: true;
  scriptPath?: string;
  fixturesDir?: string;
}

/** Fixture JSON content per event type */
function buildFixtures(
  event: string,
): { allow: object; block?: object } {
  switch (event) {
    case 'PreToolUse':
      return {
        allow: {
          description: 'Example: allows safe input',
          input: { tool_input: { command: 'echo hello' } },
          expectedExitCode: 0,
        },
        block: {
          description: 'Example: blocks dangerous input',
          input: { tool_input: { command: 'REPLACE_ME' } },
          expectedExitCode: 2,
        },
      };
    case 'PostToolUse':
      return {
        allow: {
          description: 'Example: processes tool output',
          input: { tool_name: 'Bash', tool_response: 'output here' },
          expectedExitCode: 0,
        },
      };
    case 'SessionStart':
      return {
        allow: {
          description: 'Example: session initialization',
          input: { session_id: 'test-session', cwd: '/tmp' },
          expectedExitCode: 0,
        },
      };
    case 'Stop':
      return {
        allow: {
          description: 'Example: session cleanup',
          input: { session_id: 'test-session' },
          expectedExitCode: 0,
        },
      };
    default:
      return {
        allow: {
          description: 'Example: allow input',
          input: { session_id: 'test-session' },
          expectedExitCode: 0,
        },
      };
  }
}

/**
 * Internal create function that accepts an explicit hooksDir.
 * Used by tests to avoid touching the real filesystem.
 */
export async function _createAt(opts: {
  name: string;
  event: string;
  matcher?: string;
  hooksDir: string;
}): Promise<CreateResult> {
  const { name, event, matcher, hooksDir } = opts;

  // Validate name: lowercase alphanumeric + hyphens, must start with alphanumeric
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    return { invalidName: true };
  }

  // Validate event type
  const supportedEvents = listTemplateEvents();
  if (!supportedEvents.includes(event)) {
    return { invalidEvent: true };
  }

  const scriptPath = join(hooksDir, `${name}.sh`);
  const fixturesDir = join(hooksDir, 'fixtures', name);

  // Refuse to overwrite existing hook
  if (existsSync(scriptPath)) {
    return { skipped: true };
  }

  // Create directories
  mkdirSync(hooksDir, { recursive: true });
  mkdirSync(fixturesDir, { recursive: true });

  // Write hook script
  const template = getTemplate(event, name, matcher);
  writeFileSync(scriptPath, template, 'utf8');
  chmodSync(scriptPath, 0o755);

  // Write fixture files
  const fixtures = buildFixtures(event);
  writeFileSync(
    join(fixturesDir, 'allow-example.json'),
    JSON.stringify(fixtures.allow, null, 2) + '\n',
    'utf8',
  );
  if (fixtures.block) {
    writeFileSync(
      join(fixturesDir, 'block-example.json'),
      JSON.stringify(fixtures.block, null, 2) + '\n',
      'utf8',
    );
  }

  return { created: true, scriptPath, fixturesDir };
}

/**
 * The `claude-code-hookkit create` command.
 * Scaffolds a hook script from an event-type template and writes fixture skeletons.
 */
export async function createCommand(opts: CreateOptions): Promise<void> {
  const { name, event, matcher, scope = 'project' } = opts;

  const hooksDir = getHooksDir(scope as Scope);
  const result = await _createAt({ name, event, matcher, hooksDir });

  if (result.invalidName) {
    log.error(
      `Invalid hook name: "${name}". Names must be lowercase alphanumeric with hyphens (e.g., my-guard).`,
    );
    return;
  }

  if (result.invalidEvent) {
    const supported = listTemplateEvents().join(', ');
    log.error(`Unsupported event type: "${event}". Supported types: ${supported}`);
    return;
  }

  if (result.skipped) {
    log.warn(`Hook already exists: ${join(hooksDir, name + '.sh')}. Remove it first to recreate.`);
    return;
  }

  if (result.created) {
    log.success(`Created hook: ${result.scriptPath}`);
    log.dim(`  Fixtures: ${result.fixturesDir}/allow-example.json`);
    if (event === 'PreToolUse') {
      log.dim(`  Fixtures: ${result.fixturesDir}/block-example.json`);
    }
    log.info('');
    log.info('Next steps:');
    log.dim(`  1. Edit ${result.scriptPath} to add your logic`);
    log.dim(`  2. Run: claude-code-hookkit test ${name}`);
  }
}

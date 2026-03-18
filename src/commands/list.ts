import { existsSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { listHooks } from '../registry/index.js';
import { getHooksDir } from '../config/locator.js';
import type { Scope } from '../config/locator.js';

export interface ListOptions {
  scope: string;
}

export interface ListAtOptions {
  hooksDir: string;
}

/**
 * Pad a string to a minimum width with spaces.
 */
function pad(str: string, width: number): string {
  return str.length >= width ? str : str + ' '.repeat(width - str.length);
}

/**
 * Strip ANSI escape codes from a string (for accurate width calculation).
 */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*m/g, '');
}

/**
 * Pad accounting for invisible ANSI codes in the string.
 */
function padColored(str: string, width: number): string {
  const visibleLen = stripAnsi(str).length;
  const padding = Math.max(0, width - visibleLen);
  return str + ' '.repeat(padding);
}

/**
 * Core list logic. Accepts explicit paths for testability.
 *
 * Fetches all hooks from registry, checks which scripts are installed,
 * and prints an aligned table to stdout.
 */
export async function _listAt(opts: ListAtOptions): Promise<void> {
  const { hooksDir } = opts;
  const hooks = listHooks();

  // Column widths
  const COL_NAME = 26;
  const COL_EVENT = 18;
  const COL_MATCHER = 22;
  const COL_PACK = 16;
  const COL_INSTALLED = 9;

  // Header
  const header =
    pad('Name', COL_NAME) +
    pad('Event', COL_EVENT) +
    pad('Matcher', COL_MATCHER) +
    pad('Pack', COL_PACK) +
    'Installed';
  console.log(pc.bold(header));
  console.log(pc.dim('-'.repeat(COL_NAME + COL_EVENT + COL_MATCHER + COL_PACK + COL_INSTALLED)));

  for (const hook of hooks) {
    const scriptPath = join(hooksDir, hook.scriptFile);
    const installed = existsSync(scriptPath);

    const name = padColored(installed ? pc.green(hook.name) : hook.name, COL_NAME);
    const event = pad(hook.event, COL_EVENT);
    const matcher = pad(hook.matcher ?? '-', COL_MATCHER);
    const pack = pad(hook.pack ?? '-', COL_PACK);
    const installedStr = installed ? pc.green('yes') : pc.dim('no');

    console.log(name + event + matcher + pack + installedStr);
  }
}

/**
 * Public list command — resolves paths from scope then delegates to _listAt.
 */
export async function listCommand(opts: ListOptions): Promise<void> {
  const validScopes: Scope[] = ['user', 'project', 'local'];
  const scope: Scope = validScopes.includes(opts.scope as Scope)
    ? (opts.scope as Scope)
    : 'project';

  await _listAt({ hooksDir: getHooksDir(scope) });
}

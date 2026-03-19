import { homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';

export type Scope = 'user' | 'project' | 'local';

/**
 * Walk up from cwd looking for .git or project-level .claude to find the project root.
 * Skips the home directory's .claude to avoid resolving user-scope config as project root.
 * Falls back to cwd if neither is found.
 */
function findProjectRoot(): string {
  const home = homedir();
  let dir = resolve(process.cwd());

  while (true) {
    if (existsSync(join(dir, '.git'))) {
      return dir;
    }
    // Check for .claude but skip home directory (that's user scope, not project)
    if (dir !== home && existsSync(join(dir, '.claude'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }

  return process.cwd();
}

/**
 * Resolve the settings.json path for the given scope.
 *
 * - user:    ~/.claude/settings.json
 * - project: <project-root>/.claude/settings.json
 * - local:   <project-root>/.claude/settings.local.json
 */
export function getSettingsPath(scope: Scope): string {
  switch (scope) {
    case 'user':
      return join(homedir(), '.claude', 'settings.json');
    case 'project':
      return resolve(findProjectRoot(), '.claude', 'settings.json');
    case 'local':
      return resolve(findProjectRoot(), '.claude', 'settings.local.json');
  }
}

/**
 * Return the backup path for the given scope's settings file.
 * Always settingsPath + '.backup' (single backup file, overwritten on each write).
 */
export function getBackupPath(scope: Scope): string {
  return getSettingsPath(scope) + '.backup';
}

/**
 * Resolve the hooks directory for the given scope.
 *
 * - user:           ~/.claude/hooks
 * - project/local:  <project-root>/.claude/hooks
 */
export function getHooksDir(scope: Scope): string {
  switch (scope) {
    case 'user':
      return join(homedir(), '.claude', 'hooks');
    case 'project':
    case 'local':
      return resolve(findProjectRoot(), '.claude', 'hooks');
  }
}

import { copyFile, chmod, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { getHook } from '../registry/index.js';
import { applyMerge } from '../config/manager.js';
import { getSettingsPath, getHooksDir } from '../config/locator.js';
import { log } from '../utils/logger.js';
import type { Scope } from '../config/locator.js';

export interface AddOptions {
  scope: string;
  hookName: string;
  dryRun?: boolean;
}

export interface AddAtOptions {
  settingsPath: string;
  hooksDir: string;
  /**
   * Override for the source hooks directory (registry/hooks/).
   * Defaults to the bundled registry/hooks/ relative to this file.
   * Used in tests to provide a fake scripts directory.
   */
  sourceHooksDir?: string;
  hookName: string;
  dryRun?: boolean;
}

/**
 * Resolve the bundled registry/hooks/ directory from this file's location.
 * Works for both src/ (vitest) and dist/ (built output).
 */
function getDefaultSourceHooksDir(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  // src/commands/ -> ../../registry/hooks
  return join(__dirname, '..', '..', 'registry', 'hooks');
}

/**
 * Core add logic. Accepts explicit paths for testability.
 *
 * Flow:
 * 1. Look up hook in registry — error and return if not found
 * 2. If dry-run: print preview and return
 * 3. Ensure hooksDir exists (mkdir -p)
 * 4. Copy script from sourceHooksDir to hooksDir
 * 5. chmod +x the copied script
 * 6. Call applyMerge to add settings entry
 * 7. Print summary
 */
export async function _addAt(opts: AddAtOptions): Promise<void> {
  const { settingsPath, hooksDir, hookName, dryRun = false } = opts;
  const sourceHooksDir = opts.sourceHooksDir ?? getDefaultSourceHooksDir();

  // 1. Look up hook in registry
  const hook = getHook(hookName);
  if (!hook) {
    log.error(`Unknown hook: "${hookName}". Run "claude-hooks list" to see available hooks.`);
    return;
  }

  const srcPath = join(sourceHooksDir, hook.scriptFile);
  const destPath = join(hooksDir, hook.scriptFile);

  // 2. Dry-run preview
  if (dryRun) {
    log.dryRun(`Would copy: ${srcPath} -> ${destPath}`);
    log.dryRun(`Would chmod +x: ${destPath}`);
    log.dryRun(`Would add ${hook.event}${hook.matcher ? ` [${hook.matcher}]` : ''} hook to settings.json`);
    return;
  }

  // 3. Ensure hooksDir exists
  await mkdir(hooksDir, { recursive: true });

  // 4. Copy script
  await copyFile(srcPath, destPath);

  // 5. chmod +x
  await chmod(destPath, 0o755);

  // 6. Merge into settings.json
  const result = await applyMerge({
    settingsPath,
    newHooks: [
      {
        event: hook.event,
        matcher: hook.matcher,
        hook: { type: 'command', command: destPath },
      },
    ],
    dryRun: false,
  });

  // 7. Print summary
  if (result.added.length > 0) {
    log.success(`Installed hook: ${hook.name}`);
    log.dim(`  Script: ${destPath}`);
    if (hook.pack) {
      log.dim(`  Pack: ${hook.pack}`);
    }
    log.dim(`  Event: ${hook.event}${hook.matcher ? ` [matcher: ${hook.matcher}]` : ''}`);
  } else if (result.skipped.length > 0) {
    log.warn(`Hook "${hook.name}" is already installed (skipped).`);
  }
}

/**
 * Public add command — resolves paths from scope then delegates to _addAt.
 */
export async function addCommand(opts: AddOptions): Promise<void> {
  const validScopes: Scope[] = ['user', 'project', 'local'];
  const scope: Scope = validScopes.includes(opts.scope as Scope)
    ? (opts.scope as Scope)
    : 'project';

  await _addAt({
    settingsPath: getSettingsPath(scope),
    hooksDir: getHooksDir(scope),
    hookName: opts.hookName,
    dryRun: opts.dryRun,
  });
}

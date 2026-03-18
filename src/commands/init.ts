import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname as pathDirname } from 'node:path';
import { readSettings, writeSettings } from '../config/manager.js';
import { getSettingsPath, getHooksDir } from '../config/locator.js';
import { createBackup } from '../config/backup.js';
import { log } from '../utils/logger.js';
import type { Scope } from '../config/locator.js';

export interface InitOptions {
  scope: string;
  dryRun?: boolean;
}

/** Internal options accepted by _initAt for testability */
export interface InitAtOptions {
  settingsPath: string;
  hooksDir: string;
  dryRun?: boolean;
}

/**
 * Core init logic. Accepts explicit paths so tests can use tmp directories
 * without touching real ~/.claude or .claude directories.
 *
 * Flow:
 * 1. Read existing settings (returns {} if missing)
 * 2. Check already-initialized: hooks key exists and non-empty -> no-op
 * 3. If dry-run: print what would happen and return
 * 4. Create hooksDir (mkdir -p)
 * 5. Create parent dir for settings if needed
 * 6. Backup existing settings if present
 * 7. Write settings with hooks: {} added (preserving all other keys)
 * 8. Print summary
 */
export async function _initAt(opts: InitAtOptions): Promise<void> {
  const { settingsPath, hooksDir, dryRun = false } = opts;

  // 1. Read existing settings
  const existing = await readSettings(settingsPath);

  // 2. Already initialized check: hooks key exists and is non-empty
  if (existing.hooks !== undefined) {
    const hookCount = Object.keys(existing.hooks).length;
    if (hookCount > 0) {
      log.info(`Already initialized at ${settingsPath}`);
      return;
    }
    // hooks key exists but is empty {} — treat as already seeded, still create hooksDir
    // but don't re-write settings
    if (!dryRun) {
      await mkdir(hooksDir, { recursive: true });
    }
    return;
  }

  // 3. Dry-run: print preview and return without writing
  if (dryRun) {
    log.dryRun(`Would create directory: ${hooksDir}`);
    log.dryRun(`Would seed settings.json at: ${settingsPath}`);
    log.dryRun('Would add empty hooks structure');
    return;
  }

  // 4. Create hooksDir
  const hooksDirCreated = !existsSync(hooksDir);
  await mkdir(hooksDir, { recursive: true });

  // 5. Create parent dir for settings if needed
  const settingsParent = pathDirname(settingsPath);
  await mkdir(settingsParent, { recursive: true });

  // 6. Backup existing settings (no-op if file doesn't exist)
  const backupPath = await createBackup(settingsPath);

  // 7. Write settings with hooks: {} added (all other keys preserved)
  const newSettings = { ...existing, hooks: {} };
  await writeSettings(settingsPath, newSettings);

  // 8. Print summary
  if (hooksDirCreated) {
    log.success(`Created ${hooksDir}`);
  }
  log.success(`Seeded ${settingsPath} with hooks configuration`);
  if (backupPath) {
    log.dim(`  Backed up existing settings to ${backupPath}`);
  }
}

/**
 * Public init command — resolves paths from scope then delegates to _initAt.
 */
export async function initCommand(opts: InitOptions): Promise<void> {
  const validScopes: Scope[] = ['user', 'project', 'local'];
  const scope: Scope = validScopes.includes(opts.scope as Scope)
    ? (opts.scope as Scope)
    : 'project';

  const resolvedSettingsPath = getSettingsPath(scope);
  const resolvedHooksDir = getHooksDir(scope);

  await _initAt({
    settingsPath: resolvedSettingsPath,
    hooksDir: resolvedHooksDir,
    dryRun: opts.dryRun,
  });
}

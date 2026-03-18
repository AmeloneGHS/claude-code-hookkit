import { log } from '../utils/logger.js';

export interface RestoreOptions {
  scope: string;
}

/**
 * Stub for the restore command.
 * Full implementation in Phase 1, Plan 04.
 */
export async function restoreCommand(opts: RestoreOptions): Promise<void> {
  log.info('Restore not yet implemented');
  log.dim(`  scope: ${opts.scope}`);
  process.exit(0);
}

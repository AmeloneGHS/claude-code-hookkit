import { log } from '../utils/logger.js';

export interface InitOptions {
  scope: string;
  dryRun?: boolean;
}

/**
 * Stub for the init command.
 * Full implementation in Phase 1, Plan 03.
 */
export async function initCommand(opts: InitOptions): Promise<void> {
  log.info('Init not yet implemented');
  log.dim(`  scope: ${opts.scope}`);
  if (opts.dryRun) {
    log.dim('  dry-run: true');
  }
  process.exit(0);
}

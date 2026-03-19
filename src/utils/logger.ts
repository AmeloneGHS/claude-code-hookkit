import pc from 'picocolors';

/**
 * Colored output helpers for the claude-code-hookkit CLI.
 * Uses picocolors for terminal detection, CI no-color, and minimal bundle size.
 */
export const log = {
  /** Standard informational message */
  info(msg: string): void {
    console.log(msg);
  },

  /** Success message in green */
  success(msg: string): void {
    console.log(pc.green(msg));
  },

  /** Warning message in yellow */
  warn(msg: string): void {
    console.warn(pc.yellow(msg));
  },

  /** Error message in red (to stderr) */
  error(msg: string): void {
    console.error(pc.red(msg));
  },

  /** Dimmed/secondary text */
  dim(msg: string): void {
    console.log(pc.dim(msg));
  },

  /** Dry-run prefixed message in yellow */
  dryRun(msg: string): void {
    console.log(pc.yellow('[DRY RUN]') + ' ' + msg);
  },
};

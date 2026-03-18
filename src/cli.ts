import { Command } from 'commander';

const program = new Command()
  .name('claude-hooks')
  .description('Hook manager for Claude Code — install, manage, test, and share hooks')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize claude-hooks in your project')
  .option('--scope <scope>', 'Settings scope: user, project, or local', 'project')
  .option('--dry-run', 'Preview changes without writing')
  .action(async (opts: { scope: string; dryRun?: boolean }) => {
    const { initCommand } = await import('./commands/init.js');
    await initCommand(opts);
  });

program
  .command('restore')
  .description('Restore settings.json from the last backup')
  .option('--scope <scope>', 'Settings scope: user, project, or local', 'project')
  .action(async (opts: { scope: string }) => {
    const { restoreCommand } = await import('./commands/restore.js');
    await restoreCommand(opts);
  });

program.parse();

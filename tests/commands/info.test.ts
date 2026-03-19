import { describe, it, expect, vi, afterEach } from 'vitest';
import { infoCommand } from '../../src/commands/info.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('infoCommand', () => {
  it('prints hook name and description for a known hook', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await infoCommand({ hookName: 'sensitive-path-guard' });

    const output = logSpy.mock.calls.flat().join('\n');
    expect(output).toContain('sensitive-path-guard');
    expect(output).toContain('Blocks writes to sensitive paths');
  });

  it('prints event and matcher metadata', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await infoCommand({ hookName: 'sensitive-path-guard' });

    const output = logSpy.mock.calls.flat().join('\n');
    expect(output).toContain('PreToolUse');
    expect(output).toContain('Edit|Write');
  });

  it('prints pack name', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await infoCommand({ hookName: 'sensitive-path-guard' });

    const output = logSpy.mock.calls.flat().join('\n');
    expect(output).toContain('security-pack');
  });

  it('prints fixture examples for hooks that have them', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await infoCommand({ hookName: 'sensitive-path-guard' });

    const output = logSpy.mock.calls.flat().join('\n');
    // Should show at least one fixture example description
    expect(output).toContain('Examples');
  });

  it('prints install and test hints', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await infoCommand({ hookName: 'sensitive-path-guard' });

    const output = logSpy.mock.calls.flat().join('\n');
    expect(output).toContain('claude-hooks add sensitive-path-guard');
    expect(output).toContain('claude-hooks test sensitive-path-guard');
  });

  it('shows exit 0 (allow) label for allow fixtures', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await infoCommand({ hookName: 'sensitive-path-guard' });

    const output = logSpy.mock.calls.flat().join('\n');
    // At least one fixture should be an allow case
    expect(output).toContain('allow');
  });

  it('shows exit 2 (block) label for block fixtures', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await infoCommand({ hookName: 'sensitive-path-guard' });

    const output = logSpy.mock.calls.flat().join('\n');
    // At least one fixture should be a block case
    expect(output).toContain('block');
  });

  it('works for cost-tracker hook (no matcher field)', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await infoCommand({ hookName: 'cost-tracker' });

    const output = logSpy.mock.calls.flat().join('\n');
    expect(output).toContain('cost-tracker');
    expect(output).toContain('PostToolUse');
    expect(output).toContain('cost-pack');
  });

  it('exits with error for unknown hook', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);

    await expect(infoCommand({ hookName: 'nonexistent-hook' })).rejects.toThrow('process.exit called');
    expect(errorSpy.mock.calls.flat().join('\n')).toContain('nonexistent-hook');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

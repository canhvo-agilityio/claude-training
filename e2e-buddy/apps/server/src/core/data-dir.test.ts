import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveDataDir } from './data-dir.js';

describe('resolveDataDir', () => {
  it('defaults to ~/.e2e-buddy', () => {
    const dataDir = resolveDataDir({});
    expect(dataDir.root).toBe(join(homedir(), '.e2e-buddy'));
    expect(dataDir.configFile).toBe(join(homedir(), '.e2e-buddy', 'config.json'));
    expect(dataDir.runsDir).toBe(join(homedir(), '.e2e-buddy', 'runs'));
  });

  it('honors E2E_BUDDY_HOME', () => {
    expect(resolveDataDir({ E2E_BUDDY_HOME: 'tmp/buddy' }).root).toBe(resolve('tmp/buddy'));
  });

  it('ignores a blank E2E_BUDDY_HOME', () => {
    expect(resolveDataDir({ E2E_BUDDY_HOME: '  ' }).root).toBe(join(homedir(), '.e2e-buddy'));
  });
});

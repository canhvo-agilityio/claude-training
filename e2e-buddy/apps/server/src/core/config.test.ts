import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './config.js';

describe('loadConfig', () => {
  let dir: string;
  let configFile: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'e2e-buddy-config-'));
    configFile = join(dir, 'config.json');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('creates config.json with defaults when it is missing', async () => {
    const config = await loadConfig(configFile);

    expect(config.port).toBe(4477);
    const written: unknown = JSON.parse(await readFile(configFile, 'utf8'));
    expect(written).toEqual(config);
  });

  it('reads existing values and fills the rest with defaults', async () => {
    await writeFile(configFile, JSON.stringify({ port: 5000, allowedApkDirs: ['/apks'] }));

    const config = await loadConfig(configFile);

    expect(config.port).toBe(5000);
    expect(config.allowedApkDirs).toEqual(['/apks']);
    expect(config.retention.runsPerProject).toBe(50);
  });

  it('rejects invalid JSON without overwriting the file', async () => {
    await writeFile(configFile, '{ not json');

    await expect(loadConfig(configFile)).rejects.toThrow(ConfigError);
    expect(await readFile(configFile, 'utf8')).toBe('{ not json');
  });

  it('rejects a config that fails the schema and names the field', async () => {
    await writeFile(configFile, JSON.stringify({ port: 'abc' }));

    await expect(loadConfig(configFile)).rejects.toThrow(/port/);
  });

  it('leaves no temp files behind', async () => {
    await loadConfig(configFile);

    expect(await readdir(dir)).toEqual(['config.json']);
  });
});

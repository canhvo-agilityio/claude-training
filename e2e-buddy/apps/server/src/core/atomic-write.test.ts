import { mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeJsonAtomic } from './atomic-write.js';

describe('writeJsonAtomic', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'e2e-buddy-atomic-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('writes and replaces JSON without leaving temp files', async () => {
    const file = join(dir, 'state.json');

    await writeJsonAtomic(file, { a: 1 });
    await writeJsonAtomic(file, { a: 2 });

    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ a: 2 });
    expect(await readdir(dir)).toEqual(['state.json']);
  });

  it('removes the temp file when the rename fails', async () => {
    // A non-empty directory at the target path lets the temp write succeed but makes rename fail.
    const target = join(dir, 'state.json');
    await mkdir(join(target, 'occupied'), { recursive: true });

    await expect(writeJsonAtomic(target, { a: 1 })).rejects.toThrow();
    expect(await readdir(dir)).toEqual(['state.json']);
  });
});

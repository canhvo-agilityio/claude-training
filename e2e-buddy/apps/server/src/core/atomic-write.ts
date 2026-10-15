import { randomUUID } from 'node:crypto';
import { rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

/**
 * Write JSON so readers never see a partial file: write a temp file in the same
 * directory, then rename it over the target (spec §4.1, CLAUDE.md rule 6).
 */
export async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  const tmpPath = join(dirname(filePath), `.${basename(filePath)}.${randomUUID()}.tmp`);
  try {
    await writeFile(tmpPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    await rename(tmpPath, filePath);
  } catch (err) {
    await rm(tmpPath, { force: true });
    throw err;
  }
}

import { readFile } from 'node:fs/promises';
import { ConfigSchema, type Config } from '@e2e-buddy/contracts';
import { writeJsonAtomic } from './atomic-write.js';

export class ConfigError extends Error {
  override readonly name = 'ConfigError';
}

/**
 * Read and validate `config.json`. A missing file is created with defaults;
 * an unreadable or invalid file is an error, never silently overwritten.
 */
export async function loadConfig(configFile: string): Promise<Config> {
  let raw: string;
  try {
    raw = await readFile(configFile, 'utf8');
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      const config = ConfigSchema.parse({});
      await writeJsonAtomic(configFile, config);
      return config;
    }
    throw new ConfigError(`Cannot read ${configFile}: ${errorMessage(err)}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new ConfigError(`${configFile} is not valid JSON: ${errorMessage(err)}`);
  }

  const result = ConfigSchema.safeParse(json);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new ConfigError(`${configFile} is invalid: ${issues}`);
  }
  return result.data;
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

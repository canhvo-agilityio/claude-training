import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

export interface DataDir {
  root: string;
  configFile: string;
  projectsFile: string;
  runsDir: string;
}

/** `~/.e2e-buddy/`, overridable with `E2E_BUDDY_HOME` (spec §4). */
export function resolveDataDir(env: NodeJS.ProcessEnv = process.env): DataDir {
  const override = env.E2E_BUDDY_HOME?.trim();
  const root = override ? resolve(override) : join(homedir(), '.e2e-buddy');
  return {
    root,
    configFile: join(root, 'config.json'),
    projectsFile: join(root, 'projects.json'),
    runsDir: join(root, 'runs'),
  };
}

export async function ensureDataDir(dataDir: DataDir): Promise<void> {
  await mkdir(dataDir.runsDir, { recursive: true });
}

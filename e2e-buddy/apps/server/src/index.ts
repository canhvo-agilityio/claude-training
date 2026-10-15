import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app.js';
import { loadConfig } from './core/config.js';
import { ensureDataDir, resolveDataDir } from './core/data-dir.js';

// Spec §8: loopback only, with no option to bind elsewhere.
const HOST = '127.0.0.1';

const here = dirname(fileURLToPath(import.meta.url));
// Same relative depth from src/ (dev) and dist/ (build).
const serverRoot = resolve(here, '..');
const webDistDir = resolve(serverRoot, '../web/dist');

function readVersion(): string {
  const pkg: unknown = JSON.parse(readFileSync(resolve(serverRoot, 'package.json'), 'utf8'));
  return typeof pkg === 'object' &&
    pkg !== null &&
    'version' in pkg &&
    typeof pkg.version === 'string'
    ? pkg.version
    : '0.0.0';
}

async function main(): Promise<void> {
  const dataDir = resolveDataDir();
  await ensureDataDir(dataDir);
  const config = await loadConfig(dataDir.configFile);

  const app = await buildApp({ version: readVersion(), webDistDir, logger: true });
  await app.listen({ host: HOST, port: config.port });
  app.log.info(`E2E Buddy data dir: ${dataDir.root}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

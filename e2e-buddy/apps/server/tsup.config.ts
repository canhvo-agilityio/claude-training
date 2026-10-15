import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  clean: true,
  // contracts ships TypeScript source, so bundle it into the server build.
  noExternal: ['@e2e-buddy/contracts'],
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/*',
      'apps/*',
      // Claude Code hook scripts (dev tooling, plain .mjs).
      {
        test: {
          name: 'claude-hooks',
          include: ['.claude/hooks/**/*.test.mjs'],
          environment: 'node',
        },
      },
    ],
  },
});

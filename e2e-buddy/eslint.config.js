import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // CLAUDE.md rule 3: only process-runner may spawn external commands.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'child_process', message: 'Use core/process-runner (CLAUDE.md rule 3).' },
            { name: 'node:child_process', message: 'Use core/process-runner (CLAUDE.md rule 3).' },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/server/src/core/process-runner/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
);

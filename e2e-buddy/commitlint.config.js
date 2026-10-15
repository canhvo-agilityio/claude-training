// Commit header format: `[<issue-iid>] <type>(<optional scope>): <subject>`
// e.g. `[2] feat: bootstrap pnpm monorepo`, `[11] docs(claude): add CLAUDE.md`

/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  parserPreset: {
    parserOpts: {
      headerPattern: /^\[(\d+)\] (\w+)(?:\(([\w./-]+)\))?!?: (.+)$/,
      headerCorrespondence: ['ticket', 'type', 'scope', 'subject'],
    },
  },
  plugins: [
    {
      rules: {
        'header-ticket': (parsed) => {
          const ok = typeof parsed.ticket === 'string' && parsed.ticket.length > 0;
          return [
            ok,
            'header must look like "[<issue-iid>] <type>: <subject>", e.g. "[2] feat: add health endpoint"',
          ];
        },
      },
    },
  ],
  rules: {
    'header-ticket': [2, 'always'],
    'subject-case': [0],
  },
};

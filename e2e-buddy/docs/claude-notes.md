# Claude Code notes

A running log of what worked and what didn't when building E2E Buddy with Claude Code, one entry per ticket.
Use it to improve `CLAUDE.md` and the `.claude/commands/` prompts.

## Template

```markdown
## #<iid> — <title> (YYYY-MM-DD)

**Worked:**
-

**Didn't work:**
-

**Change to CLAUDE.md / commands?**
-
```

---

## #11 — Set up CLAUDE.md and Claude Code project commands (2026-10-14)

**Worked:**

- Reading the issue with `glab issue view` and the spec before planning, and showing the plan before writing files.

**Didn't work:**

- The issue links `docs/spec.md` at the repo root, but the project lives in `e2e-buddy/`. We decided that `e2e-buddy/`
  is the project root and Claude Code is launched from there.
- The issue names the review command `review.md`. We used `review-ticket.md` instead.
- The first commit (3a19c2c) missed `CLAUDE.md` itself, even though both commands point to its Hard rules.
  It was added in a follow-up commit (2026-10-15).

**Change to CLAUDE.md / commands?**

- Update the Commands section in `CLAUDE.md` once #2 adds the pnpm scripts.
- Still to check: in a fresh session, "how do I run the tests?" and "where do shared types go?" should be answered from
  `CLAUDE.md` alone, and `/implement-ticket 1` should produce a plan that matches issue #1.

## #2 — Bootstrap pnpm monorepo (web, server, contracts) (2026-10-15)

**Worked:**

- Installing with `pnpm add` instead of hand-writing versions, then checking `pnpm peers check`.
- Verifying `pnpm dev` in the browser pane and `pnpm start` with `curl`, using a throwaway `E2E_BUDDY_HOME`.

**Didn't work:**

- Latest TypeScript (7.x) is outside typescript-eslint's peer range; pinned `typescript@~6.0.3`
  (typescript-eslint supports `<6.1.0`, so `^` would be wrong).
- Vitest 5 needs Node 22+, and Node 20 is EOL; raised the floor to Node 22 (spec says "20 LTS or later").
- pnpm 11 blocks dependency build scripts; esbuild had to be approved (`allowBuilds` in `pnpm-workspace.yaml`).
- `app.hasDecorator('sendFile')` is false for reply decorators, which broke the SPA fallback; caught by a test.
- A leftover `pnpm start` held port 4477, so the first `pnpm dev` check actually hit the production server.
  Always confirm which PID owns the port before trusting a browser check.

**Change to CLAUDE.md / commands?**

- Commands section now reflects the real scripts. Project shared runners are disabled, so CI may not run until a
  runner is enabled.
- Added husky + commitlint on top of #2. The git root is the parent `claude-training/`, so `prepare` is
  `cd .. && husky e2e-buddy/.husky` and each hook `cd`s into `e2e-buddy/`; `commit-msg` resolves the message
  path to absolute before that `cd`. Commit header format is now `[<iid>] <type>: <subject>` (replaces `Refs #<iid>`).
- Ran the new `code-reviewer` subagent on #2. It found: CI cache variable ignored by pnpm 11 (`npm_config_*` →
  `pnpm_config_store_dir`), `/api?x=1` falling through to `index.html`, an atomic-write cleanup test that could not
  fail, a hardcoded Vite proxy port and a duplicated retention default. All fixed; each new test was checked to
  fail against the old code. Follow-ups: `strictTypeChecked` ESLint, per-app globals, spec §2.1 says Node 20.

## #11 (follow-up) — Claude Code hooks for format, lint, typecheck and tests (2026-10-15)

**Worked:**

- A `PostToolUse` hook on Edit/Write runs Prettier and `eslint --fix` on just the edited file, and exits 2 with
  the remaining errors (e.g. `any`, `child_process` outside process-runner, syntax errors) so Claude fixes them at once.
- A `Stop` hook runs `pnpm typecheck` and `vitest related <changed .ts/.tsx>`. It is a no-op when no TS changed,
  and only warns (no block) when `stop_hook_active` is set, so an unfixable error cannot loop.
- Hooks are picked up in the running session; a Write of a badly formatted file came back formatted.

**Didn't work:**

- The hook was proposed earlier and then forgotten when the conversation moved to the reviewer agent. Track
  proposed-but-unapproved work explicitly.

**Change to CLAUDE.md / commands?**

- Workflow section now describes the hooks. `.claude/hooks/**` is exempt from the `child_process` ESLint rule.

## #11 (follow-up) — Block forbidden commands with a PreToolUse hook (2026-10-21)

**Worked:**

- A `PreToolUse` hook on Bash (`block-forbidden-commands.mjs`) exits 2 with a reason for commands that break the
  Workflow rules: `--no-verify`/`HUSKY=0`, force-push (`--force-with-lease` allowed), pushing to `dev`/`main`,
  `reset --hard`, `clean -f`, `checkout .`, `rm -r` outside the project, npm/yarn installs, MRs not targeting `dev`.
- The rule logic is exported and unit-tested (Vitest inline project `claude-hooks`, so `pnpm test` and the husky
  pre-commit run it). Breaking the protected-branch rule on purpose failed 7 tests, so the tests can fail.
- A headless `claude -p` launched from `e2e-buddy/` proved the hook fires end to end, and found a false positive:
  `git clean -fn` (dry run) was blocked. Fixed, with a test.
- The `code-reviewer` subagent found 4 majors that the first 61 tests missed: the hook did nothing when launched
  through a symlinked path (`argv[1]` not realpath'd), `glab mr create` with no target lands on `main` (the GitLab
  default branch), `git push origin HEAD` on `dev` slipped through, and `cd .. && rm -rf e2e-buddy` was allowed.
  It also found parser gaps (subshells, heredoc bodies, `export HUSKY=0`, `core.hooksPath`, `bash -lc`). All fixed,
  each with a regression test (94 hook tests); mutating the `HEAD` rule failed 5 of them.

**Didn't work:**

- `glab issue list` and the GitLab MCP both returned 403 (token lacks the "Work Item: Read" permission), so no new
  issue could be opened; the work is filed under #11 like the earlier hooks.
- Hooks only load from the directory Claude Code was launched in. A session started at the repo root
  (`claude-training/`) does not see `e2e-buddy/.claude/settings.json`, so nothing was blocked there.
- `/review-ticket` could not run for the same 403 (it needs the issue).
- It parses the command string, so it is a guardrail against mistakes, not a sandbox (`eval`, variables and scripts get past it).

**Change to CLAUDE.md / commands?**

- CLAUDE.md Workflow now lists what the hook blocks. Follow-up: give the GitLab token "Work Item" read/write.

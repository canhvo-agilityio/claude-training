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

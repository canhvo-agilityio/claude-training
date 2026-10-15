---
description: Read a GitLab issue and its spec sections, propose a plan, then implement and verify it
argument-hint: <issue-number>
allowed-tools: Bash(glab issue view:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch --show-current)
---

Implement GitLab issue #$ARGUMENTS for E2E Buddy.

## 1. Gather context

- Run `glab issue view $ARGUMENTS` and read the goal, tasks, acceptance criteria and "Depends on".
- Find the spec reference at the bottom of the issue (e.g. "Spec: docs/spec.md, sections 2, 8 and 11")
  and read **those sections** of `docs/spec.md`. If no sections are linked, find the relevant ones yourself
  and say which you used.
- Re-read the Hard rules in `CLAUDE.md`.
- For each issue listed under "Depends on", check whether its work is already in the repo. If it isn't, stop
  and say so.
- Run `git branch --show-current`. The branch should be `feat/$ARGUMENTS-<slug>`. If it isn't, suggest a name.
  Don't switch branches without asking.

## 2. Propose a plan, then STOP

Present:
- A summary of the issue in 2–3 lines and the spec sections you used
- The files you will create or change, with one line each on why
- The tests you will add or update (unit and/or integration with fake binaries)
- How each acceptance criterion will be verified
- Open questions or conflicts between the issue, the spec and CLAUDE.md

**Wait for explicit approval before writing any code.**

## 3. Implement

- Follow the CLAUDE.md Hard rules. Shared types go in `packages/contracts`, external commands go through
  `process-runner`, and results are never faked.
- Keep the scope to this issue. Note follow-ups in your report instead of doing them.

## 4. Verify

- Run `pnpm lint` and `pnpm test`, plus the issue's own verification step if it has one (spec §11).
- Report the real output. If something fails, fix it or say clearly what still fails. Never claim it's done when it isn't.

## 5. Wrap up

- Report each acceptance criterion as met, not met or needs a manual check.
- Add an entry to `docs/claude-notes.md` using the template there.
- Suggest a commit message with the header `[$ARGUMENTS] <type>: <subject>`. Don't commit or push unless asked.

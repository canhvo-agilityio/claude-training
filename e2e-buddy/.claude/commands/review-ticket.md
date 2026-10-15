---
description: Review the current branch's diff against CLAUDE.md rules and the issue's acceptance criteria
argument-hint: "[issue-number]"
allowed-tools: Bash(glab issue view:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git show:*), Bash(git branch --show-current)
---

Review the current changes for E2E Buddy. This is a **read-only** review: don't edit files.

## 1. Find the issue

- If `$ARGUMENTS` is set, use it as the issue number.
- Otherwise take the number from the branch name (`git branch --show-current`, pattern `feat/<iid>-<slug>`).
- If neither gives a number, ask for one.
- Run `glab issue view <iid>` and pull out the acceptance criteria and the linked spec sections.

## 2. Collect the diff

- `git status` (include untracked files)
- `git fetch origin dev`, then `git diff origin/dev...HEAD` and `git diff` for uncommitted changes
- `git log origin/dev..HEAD --oneline`, and check that each commit header matches `[<iid>] <type>: <subject>`

## 3. Check

Check the diff against each item in the **Hard rules** and **Workflow** sections of `CLAUDE.md`, especially:
- any `any`, or a contract type declared outside `packages/contracts`
- `child_process` used outside `process-runner`, `shell: true`, or command strings built from input
- hardcoded or faked results, or fake-binary paths reachable from production code
- missing path or ID validation at the API boundary
- non-atomic writes to `run.json` or `projects.json`
- new behavior without tests

Then check each acceptance criterion and spec requirement from the linked sections.

## 4. Report

Give one table, with `file:line` references for anything not marked pass:

| Item | Source | Result | Evidence |
| --- | --- | --- | --- |
| e.g. No `any` | CLAUDE.md rule 1 | pass / fail / not covered | `apps/server/src/x.ts:42` |

Finish with the blocking issues first, then non-blocking suggestions. Say whether lint and tests were run.
Don't run them yourself unless asked.

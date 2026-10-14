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

**Change to CLAUDE.md / commands?**
- Update the Commands section in `CLAUDE.md` once #2 adds the pnpm scripts.
- Still to check: in a fresh session, "how do I run the tests?" and "where do shared types go?" should be answered from
  `CLAUDE.md` alone, and `/implement-ticket 1` should produce a plan that matches issue #1.

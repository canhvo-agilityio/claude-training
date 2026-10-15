---
name: create-mr
description: Commit the current changes, push the branch to origin (GitLab) and open a Merge Request into the `dev` branch. Use when the user invokes /create-mr, or says "create an MR", "push and open an MR", "commit and create a merge request", "ship this", "tạo MR".
argument-hint: "[short description / MR title (optional)]"
allowed-tools: Bash(git *), Bash(glab *)
---

# create-mr

Commit → push → open an MR into `dev` for the current repo (GitLab: `gitlab.asoft-python.com`).

User-provided arguments (if any): `$ARGUMENTS` — use them as a hint for the commit message / MR title.

## Step 1 — Check the state

Run in parallel:

```bash
git status --short
git branch --show-current
git diff --stat HEAD
git log --oneline -5
```

- If there are **no changes** and the branch has no unpushed commits → tell the user and stop.
- If on `main` or `dev` → **do not commit directly**. Create a new branch named `<type>/<short-kebab-case-description>` (e.g. `feat/add-login`, `fix/null-check`), derived from the changes, then `git switch -c <branch>`.

## Step 2 — Commit

1. Read `git diff` (and the contents of untracked files) to understand the changes.
2. **Do not** add sensitive files (`.env`, credentials, keys, build output/`node_modules`). If you see any, ask the user first.
3. Add files by name (avoid a blind `git add -A` if there are unexpected files).
4. Write the commit message in the format enforced by commitlint (`commitlint.config.js`). The `<iid>` is the
   GitLab issue number, usually taken from the branch name `feat/<iid>-<slug>`:
   ```
   [<iid>] <type>(<optional scope>): <short summary, present tense>

   <brief explanation of why, if needed>
   ```
   `type`: feat | fix | refactor | docs | test | chore | style | perf
5. Commit using a HEREDOC to preserve formatting. If a pre-commit hook fails → fix the issue and create a **new** commit (no `--amend`, no `--no-verify`).

## Step 3 — Push

```bash
git push -u origin <branch>
```

Never use `--force` unless the user explicitly asks for it.

## Step 4 — Open the MR into `dev`

Check whether an MR already exists:

```bash
glab mr list --source-branch <branch> --target-branch dev
```

If one exists → just report the existing MR link (the push in step 3 already updated it).

Otherwise, create one:

```bash
glab mr create \
  --source-branch <branch> \
  --target-branch dev \
  --title "<title = first line of the commit, or a summary if there are several commits>" \
  --description "$(cat <<'EOF'
## Summary
- <bullet points of the main changes>

## How to test
- <test/verify steps>
EOF
)" \
  --remove-source-branch \
  --yes
```

Build the MR description from **all** commits between `origin/dev` and the branch: `git log origin/dev..HEAD --oneline`.

### If `glab` fails (not logged in / wrong host)

- Suggest the user run: `! glab auth login --hostname gitlab.asoft-python.com`
- Or fall back to GitLab push options (no glab needed):
  ```bash
  git push -u origin <branch> \
    -o merge_request.create \
    -o merge_request.target=dev \
    -o merge_request.title="<title>" \
    -o merge_request.remove_source_branch
  ```
  GitLab prints the MR link in the push output.

## Step 5 — Report the result

Reply briefly: branch name, commit hash + message, and the **MR link**. If any step failed, say which step and include the error output.

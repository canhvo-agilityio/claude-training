import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { findViolation, splitCommands } from './block-forbidden-commands.mjs';

const projectDir = '/work/e2e-buddy';
const ctx = (branch = 'feat/11-x') => ({ projectDir, cwd: projectDir, currentBranch: () => branch });
const blocked = (command, branch) => findViolation(command, ctx(branch));

describe('splitCommands', () => {
  it('splits on shell separators and keeps quoted text in one word', () => {
    expect(splitCommands(`cd apps && git commit -m "skip --no-verify; later" || echo 'a | b'`)).toEqual([
      ['cd', 'apps'],
      ['git', 'commit', '-m', 'skip --no-verify; later'],
      ['echo', 'a | b'],
    ]);
  });

  it('keeps a heredoc commit message inside $(…) as one word', () => {
    const cmd = `git commit -m "$(cat <<'EOF'\n[11] chore: add hook (see #11)\n\nDon't use --no-verify\nEOF\n)"`;
    const [words] = splitCommands(cmd);
    expect(words.slice(0, 3)).toEqual(['git', 'commit', '-m']);
    expect(words).toHaveLength(4);
  });

  it('does not treat 2>&1 as a background separator', () => {
    expect(splitCommands('pnpm test 2>&1 | tail')).toEqual([
      ['pnpm', 'test', '2>&1'],
      ['tail'],
    ]);
  });
});

describe('findViolation', () => {
  it.each([
    'git commit --no-verify -m "x"',
    'git commit -nm "x"',
    'git commit -n -m "x"',
    'HUSKY=0 git commit -m "x"',
    'git push --no-verify',
    'git push --force origin feat/11-x',
    'git push -f',
    'git push origin +feat/11-x',
    'git push origin dev',
    'git push origin HEAD:dev',
    'git push origin HEAD:refs/heads/main',
    'git -C .. push origin main',
    'git push origin --delete feat/old',
    'git reset --hard origin/dev',
    'git clean -fd',
    'git checkout .',
    'git restore .',
    'rm -rf /',
    'rm -rf ~',
    'rm -rf $HOME/projects',
    'rm -rf ..',
    'rm -rf .',
    'rm -r *',
    'rm -rf /Users/someone/other-repo',
    'npm install lodash',
    'yarn add lodash',
    'glab mr create --target-branch main --title x',
    'glab mr create -b main',
    'cd apps && git push -f',
    'bash -c "git push --force"',
    'env HUSKY=0 git commit -m x',
    'sudo rm -rf /',
    // from the code-reviewer pass
    'glab mr create --fill --yes',
    'cd .. && rm -rf e2e-buddy',
    'cd ~ && rm -rf projects',
    'cd "$SOMEWHERE" && rm -rf build',
    'rm -rf "$DIR"',
    '(cd apps && git push -f)',
    '{ git push --force; }',
    'if true; then git push --force; fi',
    "cat > n.md <<EOF\nDon't\nEOF\ngit push --force",
    "git commit -m \"$(cat <<'EOF'\n[11] chore: wip (part 1\nEOF\n)\" && git push --force",
    'export HUSKY=0 && git commit -m x',
    'git -c core.hooksPath=/dev/null commit -m x',
    'timeout 60 git push --force',
    'ls | xargs rm -rf',
    'bash -lc "git push --force"',
    'git restore --staged --worktree .',
    'git push -u origin feat/11-x -o merge_request.create -o merge_request.target=main',
    'npm --prefix apps/web install lodash',
    'yarn',
    // from the @claude review on GitHub PR #2
    'git \\\n  push --force',
    'git commit -m x \\\n--no-verify',
    'glab mr \\\n create --target-branch main',
    'npm \\\n install lodash',
    'echo $(git push --force)',
    'x=$(git reset --hard)',
    'echo `git push --force`',
    'echo "result: `git push -f`"',
    'echo "$(git clean -fd)"',
    '(cd apps/web && ls); rm -rf ../server',
    'cd "$X" && bash -c "rm -rf build"',
    'git config core.hooksPath /dev/null',
    'git config --local core.hookspath .nohooks',
    'git push --mirror',
    'git push --all origin',
  ])('blocks %s', (command) => {
    expect(blocked(command)).toEqual(expect.any(String));
  });

  it.each([
    ['git push', 'dev'],
    ['git push -u origin', 'main'],
    ['git push 2>&1', 'dev'],
    ['git push -u origin HEAD', 'dev'],
    ['git push origin @', 'main'],
  ])('blocks a bare "%s" while on %s', (command, branch) => {
    expect(blocked(command, branch)).toMatch(/directly is blocked/);
  });

  it.each([
    'git status',
    'git commit -m "[11] chore: never use --no-verify or push -f"',
    'git commit -am "x"',
    'git push',
    'git push -u origin feat/11-block-forbidden-commands',
    'git push --force-with-lease origin feat/11-x',
    'git push origin feat/11-x 2>&1',
    'git checkout -b feat/12-y origin/dev',
    'git restore --staged .',
    'git reset --soft HEAD~1',
    'git clean -n',
    'git clean -fn',
    'git clean -fd --dry-run',
    'rm -rf dist apps/web/dist node_modules',
    'rm -rf /tmp/claude-501/scratch',
    'rm file.txt',
    'pnpm install',
    'npm run build',
    'npx vitest',
    'glab mr create --target-branch dev --title x',
    'echo "git push --force" > notes.txt',
    "git commit -F - <<'EOF'\n[11] chore: x\n\ngit push --force is now blocked\nEOF",
    "cat >> docs/claude-notes.md <<'EOF'\nnpm install lodash broke the lockfile\nEOF\ngit status",
    "git commit -m \"$(cat <<'EOF'\n[11] chore: x\n\n1) item\n\"quoted\" push -f\nEOF\n)\"",
    'git push -u origin HEAD',
    'git push -u origin feat/11-x -o merge_request.create -o merge_request.target=dev',
    'cd apps/web && rm -rf ../server/dist',
    'cd apps/web/dist && rm -rf *',
    'rm -rf apps/web/dist/*',
    'npm install -g pnpm@11',
    'yarn --version',
    'cat <<< "git push --force"',
    'git status # tidy; git push -f',
    "git commit -m 'literal $(git push --force) in single quotes'",
    "git commit -m \"$(cat <<'EOF'\n[11] fix: block git push --force inside $(…)\nEOF\n)\"",
    '(cd apps/web && ls); rm -rf apps/server/dist',
    'git config --get core.hooksPath',
    'git config --unset core.hooksPath',
    'echo "issue #12"',
  ])('allows %s', (command) => {
    expect(blocked(command)).toBeNull();
  });
});

describe('hook script', () => {
  const script = join(import.meta.dirname, 'block-forbidden-commands.mjs');
  const run = (command, path = script) => {
    try {
      execFileSync('node', [path], {
        input: JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd: projectDir }),
        env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
        encoding: 'utf8',
        stdio: 'pipe',
      });
      return { code: 0, stderr: '' };
    } catch (err) {
      return { code: err.status, stderr: err.stderr };
    }
  };

  it('exits 2 with the reason on stderr for a forbidden command', () => {
    const { code, stderr } = run('git push --force');
    expect(code).toBe(2);
    expect(stderr).toMatch(/Force-pushing is blocked/);
  });

  it('still blocks when launched through a symlinked path', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bfc-'));
    const link = join(dir, 'hooks');
    symlinkSync(import.meta.dirname, link);
    try {
      expect(run('git push --force', join(link, 'block-forbidden-commands.mjs')).code).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('can be imported without an entry script (node -e)', () => {
    const code = `import(${JSON.stringify(script)}).then((m) => console.log(typeof m.findViolation))`;
    expect(execFileSync('node', ['-e', code], { encoding: 'utf8' }).trim()).toBe('function');
  });

  it('exits 0 for an allowed command', () => {
    expect(run('pnpm test').code).toBe(0);
  });
});

#!/usr/bin/env node
// Stop hook: before Claude reports it is done, typecheck every workspace and run the tests related to the
// changed TypeScript files. Exit 2 keeps Claude working with the errors; a second failure in a row only
// warns, so an unfixable error cannot loop forever.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MAX_OUTPUT = 4000;

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const input = JSON.parse(readFileSync(0, 'utf8'));

function git(args) {
  return execFileSync('git', args, { cwd: projectDir, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
}

/** Run a command; return its tail output on failure, or null on success. */
function run(cmd, args) {
  try {
    execFileSync(cmd, args, { cwd: projectDir, encoding: 'utf8', stdio: 'pipe' });
    return null;
  } catch (err) {
    const out = `${err.stdout ?? ''}${err.stderr ?? ''}`.trim() || String(err);
    return out.length > MAX_OUTPUT ? `…${out.slice(-MAX_OUTPUT)}` : out;
  }
}

// Paths relative to the project dir: tracked changes since HEAD plus untracked files.
const changed = [
  ...git(['diff', '--name-only', '--relative', 'HEAD']),
  ...git(['ls-files', '--others', '--exclude-standard']),
].filter(
  (file) =>
    /\.(ts|tsx)$/.test(file) &&
    !/(^|\/)(node_modules|dist|coverage)\//.test(file) &&
    existsSync(join(projectDir, file)),
);

if (changed.length === 0 || !existsSync(join(projectDir, 'node_modules'))) process.exit(0);

const failures = [];

const typecheck = run('pnpm', ['--silent', 'typecheck']);
if (typecheck) failures.push(`pnpm typecheck failed:\n${typecheck}`);

const vitest = join(projectDir, 'node_modules', '.bin', 'vitest');
const tests = run(vitest, ['related', ...changed, '--run', '--configLoader', 'runner', '--passWithNoTests']);
if (tests) failures.push(`Tests related to the changed files failed:\n${tests}`);

if (failures.length === 0) process.exit(0);

const report = failures.join('\n\n');
if (input.stop_hook_active) {
  console.log(
    JSON.stringify({
      systemMessage: `Typecheck/tests still failing after a fix attempt; stopping anyway.\n${report}`,
    }),
  );
  process.exit(0);
}

console.error(`${report}\n\nFix these before finishing (changed files: ${changed.join(', ')}).`);
process.exit(2);

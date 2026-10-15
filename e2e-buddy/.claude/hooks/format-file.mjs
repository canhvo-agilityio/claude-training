#!/usr/bin/env node
// PostToolUse hook (Edit | Write | MultiEdit): format and lint the one file Claude just changed.
// Exit 2 sends stderr back to Claude so it fixes the problem right away.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';

const PRETTIER_EXTS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.md', '.css', '.html', '.yml', '.yaml']);
const ESLINT_EXTS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const input = JSON.parse(readFileSync(0, 'utf8'));
const filePath = input.tool_input?.file_path;
if (typeof filePath !== 'string') process.exit(0);

const absPath = resolve(projectDir, filePath);
const relPath = relative(projectDir, absPath);
const outsideProject = relPath.startsWith('..') || isAbsolute(relPath);
if (outsideProject || !existsSync(absPath) || /(^|\/)(node_modules|dist|coverage)\//.test(relPath)) {
  process.exit(0);
}

const bin = (name) => join(projectDir, 'node_modules', '.bin', name);

/** Run a local binary; return its output on failure, or null on success. */
function run(name, args) {
  try {
    execFileSync(bin(name), args, { cwd: projectDir, encoding: 'utf8', stdio: 'pipe' });
    return null;
  } catch (err) {
    return `${err.stdout ?? ''}${err.stderr ?? ''}`.trim() || String(err);
  }
}

const ext = extname(absPath);

// .prettierignore still applies; --ignore-unknown skips files Prettier cannot parse by type.
if (PRETTIER_EXTS.has(ext) && existsSync(bin('prettier'))) {
  const out = run('prettier', ['--write', '--ignore-unknown', '--log-level', 'warn', relPath]);
  if (out) {
    console.error(`Prettier could not format ${relPath} (likely a syntax error):\n${out}`);
    process.exit(2);
  }
}

if (ESLINT_EXTS.has(ext) && existsSync(bin('eslint'))) {
  const out = run('eslint', ['--fix', '--no-warn-ignored', relPath]);
  if (out) {
    console.error(`ESLint errors remain in ${relPath} after --fix. Fix them before continuing:\n${out}`);
    process.exit(2);
  }
}

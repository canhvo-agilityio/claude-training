#!/usr/bin/env node
// PreToolUse hook (Bash): refuse commands that break the CLAUDE.md workflow or destroy work before they run.
// Exit 2 blocks the call and sends the reason to Claude, so it picks the allowed way instead.
// This is a guardrail against mistakes, not a sandbox: a determined command (eval, variables, scripts) can get past it.
// Command substitutions (`$(…)`, backticks) and `bash -c` bodies are checked as commands of their own.
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROTECTED_BRANCHES = new Set(['dev', 'main']);
const SEPARATORS = new Set(['&&', '||', ';', '|', '&', '\n']);
const SUBSHELL = new Set(['(', ')']);
// Words that run the command after them: skip them (and their options) to reach the real command.
const WRAPPERS = new Set(['env', 'command', 'sudo', 'nohup', 'time', 'exec', 'timeout', 'nice', 'xargs', 'export']);
const KEYWORDS = new Set(['{', '}', '!', 'if', 'then', 'else', 'elif', 'fi', 'do', 'done', 'while', 'until']);
const SHELLS = new Set(['sh', 'bash', 'zsh']);

/**
 * Split a shell command into simple commands, each a list of words. Quotes are honoured so text inside a
 * commit message (e.g. "--no-verify") never counts as a flag; `$(…)` stays inside its word, and heredoc bodies
 * are skipped so their lines are not read as commands.
 */
export function splitCommands(command) {
  return tokenize(command).commands;
}

/**
 * Tokenize like `splitCommands`, also returning the bodies of command substitutions. `(` and `)` of a subshell
 * come back as one-word commands so callers can scope `cd` to the subshell.
 */
function tokenize(command) {
  const commands = [];
  const substitutions = [];
  let subStart = -1; // start of the body of the outermost quoted `$(`
  let words = [];
  let word = '';
  let inWord = false;
  let quote = null;
  let depth = 0; // `$(` nesting inside double quotes
  let heredocs = []; // delimiters whose bodies start after the next newline

  const endWord = () => {
    if (inWord) words.push(word);
    word = '';
    inWord = false;
  };
  const endCommand = () => {
    endWord();
    if (words.length > 0) commands.push(words);
    words = [];
  };
  /** At `<<` (not `<<<`), read the delimiter; return the index of its last character, or -1. */
  const readHeredoc = (i) => {
    const m = /^<<-?[ \t]*(['"]?)([A-Za-z0-9_]+)\1/.exec(command.slice(i));
    if (!m || command[i + 2] === '<') return -1;
    heredocs.push(m[2]);
    return i + m[0].length - 1;
  };
  /** At a newline with pending heredocs, return the index of the newline that ends the last delimiter line. */
  const skipHeredocs = (i) => {
    let pos = i + 1;
    for (const delim of heredocs) {
      while (pos < command.length) {
        const nl = command.indexOf('\n', pos) === -1 ? command.length : command.indexOf('\n', pos);
        const line = command.slice(pos, nl).replace(/^\t+/, '');
        pos = nl + 1;
        if (line === delim) break;
      }
    }
    heredocs = [];
    return Math.min(pos - 1, command.length);
  };

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (quote) {
      if (ch === quote && depth === 0) {
        quote = null;
      } else if (ch === '\\' && quote === '"') {
        word += command[++i] ?? '';
      } else if (quote === '"' && depth > 0 && ch === '<' && command[i + 1] === '<') {
        const end = readHeredoc(i);
        const stop = end === -1 ? i : end;
        word += command.slice(i, stop + 1);
        i = stop;
      } else if (quote === '"' && depth > 0 && ch === '\n' && heredocs.length > 0) {
        const end = skipHeredocs(i);
        word += command.slice(i, end + 1);
        i = end;
      } else if (quote === '"' && ch === '$' && command[i + 1] === '(') {
        word += '$(';
        i++;
        if (depth++ === 0) subStart = i + 1;
      } else if (quote === '"' && depth === 0 && ch === '`') {
        const end = closingBacktick(command, i);
        substitutions.push(command.slice(i + 1, end));
        word += command.slice(i, end + 1);
        i = end;
      } else {
        if (quote === '"' && depth > 0 && ch === '(') depth++;
        else if (quote === '"' && depth > 0 && ch === ')' && --depth === 0) substitutions.push(command.slice(subStart, i));
        word += ch;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      inWord = true;
    } else if (ch === '\\' && command[i + 1] === '\n') {
      i++; // line continuation: the shell drops both characters
    } else if (ch === '\\') {
      word += command[++i] ?? '';
      inWord = true;
    } else if (ch === '#' && !inWord) {
      // A comment runs to the end of the line; the newline itself still ends the command.
      while (i + 1 < command.length && command[i + 1] !== '\n') i++;
    } else if (ch === '`') {
      const end = closingBacktick(command, i);
      substitutions.push(command.slice(i + 1, end));
      word += command.slice(i, end + 1);
      i = end;
      inWord = true;
    } else if (ch === '$' && command[i + 1] === '(') {
      // Keep a whole unquoted command substitution as part of the current word.
      const start = i + 2;
      let level = 0;
      for (; i < command.length; i++) {
        word += command[i];
        if (command[i] === '(') level++;
        else if (command[i] === ')' && --level === 0) break;
      }
      substitutions.push(command.slice(start, i));
      inWord = true;
    } else if (SUBSHELL.has(ch)) {
      endCommand();
      commands.push([ch]);
    } else if (ch === '<' && command[i + 1] === '<') {
      const end = readHeredoc(i);
      if (end === -1) {
        word += ch;
        inWord = true;
      } else {
        endWord();
        i = end;
      }
    } else if (ch === ' ' || ch === '\t') {
      endWord();
    } else if (ch === '&' && (command[i - 1] === '>' || command[i - 1] === '<')) {
      word += ch; // `2>&1`, not a background `&`
      inWord = true;
    } else if (ch === '\n' && heredocs.length > 0) {
      endCommand();
      i = skipHeredocs(i);
    } else if (SEPARATORS.has(ch) || SEPARATORS.has(command.slice(i, i + 2))) {
      if (SEPARATORS.has(command.slice(i, i + 2))) i++;
      endCommand();
    } else {
      word += ch;
      inWord = true;
    }
  }
  endCommand();
  return { commands, substitutions };
}

/** Index of the backtick that closes the one at `i` (or the end of the string). */
function closingBacktick(command, i) {
  for (let j = i + 1; j < command.length; j++) {
    if (command[j] === '\\') j++;
    else if (command[j] === '`') return j;
  }
  return command.length;
}

/** Remove redirections (`> out.log`, `2>&1`) so they are not read as arguments. */
function stripRedirects(words) {
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const m = /^\d*(>>?|<)(&\d+|.*)$/.exec(words[i]);
    if (!m) out.push(words[i]);
    else if (m[2] === '') i++; // the target is the next word
  }
  return out;
}

/** Peel off `VAR=value`, keywords and wrappers like `env`/`timeout 60`; return the env words and the real argv. */
function unwrap(words) {
  const env = [];
  let i = 0;
  while (i < words.length) {
    const w = words[i];
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w)) env.push(w);
    else if (KEYWORDS.has(w)) {
      // skip
    } else if (WRAPPERS.has(w)) {
      while (i + 1 < words.length && /^(-|\d+[smhd]?$)/.test(words[i + 1])) i++;
    } else break;
    i++;
  }
  return { env, argv: words.slice(i) };
}

/** Skip git's global options (`-C <dir>`, `-c k=v`, `--no-pager`, …) to reach the subcommand. */
function gitSubcommand(args) {
  const config = [];
  let i = 0;
  while (i < args.length && args[i].startsWith('-')) {
    if (args[i] === '-c') config.push(args[i + 1] ?? '');
    if (args[i] === '-C' || args[i] === '-c') i++;
    i++;
  }
  return { sub: args[i], rest: args.slice(i + 1), config };
}

const hasFlag = (args, ...flags) => args.some((a) => flags.includes(a));
/** True when a short flag appears alone or combined, e.g. `-f` in `-fd`. */
const hasShort = (args, letter) => args.some((a) => /^-[a-zA-Z]+$/.test(a) && a.includes(letter));

/** `git push` options that take a value, so the value is not mistaken for a remote or refspec. */
const PUSH_VALUE_OPTS = new Set(['-o', '--push-option', '--repo', '--receive-pack', '--exec']);

function pushArgs(rest) {
  const positional = [];
  const pushOptions = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (PUSH_VALUE_OPTS.has(a)) {
      if (a === '-o' || a === '--push-option') pushOptions.push(rest[i + 1] ?? '');
      i++;
    } else if (a.startsWith('--push-option=')) pushOptions.push(a.slice('--push-option='.length));
    else if (!a.startsWith('-')) positional.push(a);
  }
  return { positional, pushOptions };
}

function checkGit(args, ctx) {
  const { sub, rest, config } = gitSubcommand(args);

  if (config.some((c) => /^core\.hookspath=/i.test(c))) {
    return 'Overriding core.hooksPath skips the husky hooks (CLAUDE.md Workflow). Fix what the hook reports instead.';
  }
  const readOnlyConfig = hasFlag(rest, '--get', '--get-all', '--unset', '--list', '-l');
  if (sub === 'config' && !readOnlyConfig && rest.some((a) => /^core\.hookspath$/i.test(a))) {
    return 'Setting core.hooksPath skips the husky hooks (CLAUDE.md Workflow). Fix what the hook reports instead.';
  }
  if ((sub === 'commit' || sub === 'push' || sub === 'merge') && hasFlag(rest, '--no-verify')) {
    return 'Never bypass the husky hooks with --no-verify (CLAUDE.md Workflow). Fix what the hook reports instead.';
  }
  if (sub === 'commit' && hasShort(rest, 'n')) {
    return 'git commit -n skips the husky hooks (CLAUDE.md Workflow). Fix what the hook reports instead.';
  }

  if (sub === 'push') {
    const { positional, pushOptions } = pushArgs(rest);
    if (hasFlag(rest, '--force') || hasShort(rest, 'f') || positional.some((a) => a.startsWith('+'))) {
      return 'Force-pushing is blocked. If you rebased your own feature branch, use --force-with-lease.';
    }
    if (hasFlag(rest, '--mirror', '--all', '--branches')) {
      return 'git push --mirror/--all can overwrite dev and main without naming them. Push one feature branch.';
    }
    if (hasFlag(rest, '--delete') || hasShort(rest, 'd') || positional.some((a) => a.startsWith(':'))) {
      return 'Deleting remote branches from Claude is blocked; do it in GitLab.';
    }
    const mrTarget = pushOptions.find((o) => o.startsWith('merge_request.target='))?.split('=')[1];
    if (mrTarget !== undefined && mrTarget !== 'dev') {
      return `MRs target dev only (CLAUDE.md Workflow), not ${mrTarget}.`;
    }
    // `git push origin dev`, `git push origin HEAD:dev`, or `git push [origin HEAD]` while on dev/main.
    const refspecs = positional.slice(1);
    const targets = (refspecs.length > 0 ? refspecs.map((r) => r.split(':').pop()) : ['HEAD']).map((t) =>
      t === 'HEAD' || t === '@' ? ctx.currentBranch() : t,
    );
    const hit = targets.find((t) => PROTECTED_BRANCHES.has(t?.replace(/^refs\/heads\//, '')));
    if (hit) {
      return `Pushing to ${hit} directly is blocked. Push a feat/<iid>-<slug> branch and open an MR into dev (/create-mr).`;
    }
  }

  if (sub === 'reset' && hasFlag(rest, '--hard')) {
    return 'git reset --hard throws away uncommitted work. Ask the user first, or use git stash.';
  }
  const dryRun = hasFlag(rest, '--dry-run') || hasShort(rest, 'n');
  if (sub === 'clean' && !dryRun && (hasFlag(rest, '--force') || hasShort(rest, 'f'))) {
    return 'git clean -f deletes untracked files for good. Ask the user first, or list them with git clean -n.';
  }
  const worktree = sub === 'checkout' || !hasFlag(rest, '--staged', '-S') || hasFlag(rest, '--worktree', '-W');
  if ((sub === 'checkout' || sub === 'restore') && rest.includes('.') && worktree) {
    return `git ${sub} . discards every uncommitted change. Ask the user first, or restore specific files.`;
  }
  return null;
}

const TEMP_DIRS = [...new Set([tmpdir(), '/tmp', '/private/tmp'])];
const isInside = (dir, path) => {
  const rel = relative(dir, path);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
};

function checkRm(args, ctx, cwd) {
  const recursive = hasFlag(args, '--recursive') || hasShort(args, 'r') || hasShort(args, 'R');
  if (!recursive) return null;
  const targets = args.filter((a) => !a.startsWith('-'));
  if (targets.length === 0) {
    return 'rm -r without explicit paths (e.g. from xargs) is blocked: its targets cannot be checked.';
  }
  for (const target of targets) {
    if (/^(~|\$HOME|\$\{HOME\})(\/|$)/.test(target) || target.startsWith('$')) {
      return `rm -r ${target} is blocked: it can delete far more than intended.`;
    }
    if (cwd === null && !isAbsolute(target)) {
      return `rm -r ${target} is blocked: an earlier cd makes its location unknown. Use a path inside the project.`;
    }
    // `dir/*` empties `dir`, so it gets the same check as `dir` itself.
    const abs = resolve(cwd ?? ctx.projectDir, target.replace(/(^|\/)\*$/, '$1.'));
    if (TEMP_DIRS.some((dir) => isInside(dir, abs))) continue;
    if (!isInside(ctx.projectDir, abs)) {
      return `rm -r ${target} is blocked: it is the project root or outside it (${ctx.projectDir}).`;
    }
  }
  return null;
}

const INSTALLS = new Set(['install', 'i', 'ci', 'add', 'remove', 'uninstall', 'update']);

function checkPackageManager(cmd, args) {
  if (cmd !== 'npm' && cmd !== 'yarn') return null;
  if (hasFlag(args, '-g', '--global')) return null;
  let sub;
  for (let i = 0; i < args.length && sub === undefined; i++) {
    if (args[i] === '--prefix' || args[i] === '--cwd' || args[i] === '-C') i++;
    else if (!args[i].startsWith('-')) sub = args[i];
  }
  // A bare `yarn` installs; `yarn --version` does not.
  const installs = INSTALLS.has(sub) || (cmd === 'yarn' && sub === undefined && args.length === 0);
  if (installs) {
    return 'This repo uses pnpm 11 (CLAUDE.md Commands); npm/yarn would write a second lockfile. Use pnpm.';
  }
  return null;
}

function checkGlab(args) {
  if (args[0] !== 'mr' || args[1] !== 'create') return null;
  const i = args.findIndex((a) => a === '--target-branch' || a === '-b');
  const target = i >= 0 ? args[i + 1] : args.find((a) => a.startsWith('--target-branch='))?.split('=')[1];
  if (target === undefined) {
    return 'glab mr create without --target-branch opens the MR into the GitLab default branch (main). Pass --target-branch dev.';
  }
  if (target !== 'dev') {
    return `MRs target dev only (CLAUDE.md Workflow), not ${target}.`;
  }
  return null;
}

/** Return the directory after `cd <arg>`, or null when it cannot be known statically. */
function nextCwd(cwd, arg) {
  if (arg === undefined || arg === '~') return homedir();
  if (cwd === null || arg === '-' || arg.includes('$')) return null;
  return resolve(cwd, arg.replace(/^~(?=\/)/, homedir()));
}

/** Return why `command` is forbidden, or null when it may run. */
export function findViolation(command, ctx) {
  const { commands, substitutions } = tokenize(command);
  for (const body of substitutions) {
    const inner = findViolation(body, ctx);
    if (inner) return inner;
  }
  let cwd = ctx.cwd;
  const subshells = []; // cwd to restore when each `( … )` closes
  for (const words of commands) {
    if (words.length === 1 && SUBSHELL.has(words[0])) {
      if (words[0] === '(') subshells.push(cwd);
      else if (subshells.length > 0) cwd = subshells.pop();
      continue;
    }
    const { env, argv } = unwrap(stripRedirects(words));
    if (env.some((e) => e === 'HUSKY=0')) {
      return 'HUSKY=0 skips the husky hooks (CLAUDE.md Workflow). Fix what the hook reports instead.';
    }
    const [cmd, ...args] = argv;
    if (cmd === 'cd' || cmd === 'pushd') {
      cwd = nextCwd(cwd, args.find((a) => !a.startsWith('-') || a === '-'));
      continue;
    }
    if (SHELLS.has(cmd) && /^-[a-z]*c$/.test(args[0] ?? '') && typeof args[1] === 'string') {
      const inner = findViolation(args[1], { ...ctx, cwd });
      if (inner) return inner;
      continue;
    }
    const reason =
      (cmd === 'git' && checkGit(args, ctx)) ||
      (cmd === 'rm' && checkRm(args, ctx, cwd)) ||
      checkPackageManager(cmd, args) ||
      (cmd === 'glab' && checkGlab(args));
    if (reason) return reason;
  }
  return null;
}

function currentBranch(cwd) {
  try {
    return execFileSync('git', ['branch', '--show-current'], { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch {
    return undefined;
  }
}

// realpath both sides: launched through a symlinked path, a plain compare is false and the hook would allow everything.
// argv[1] is unset under `node -e` / a REPL import; only run when this file is the entry point.
const entry = process.argv[1];
if (entry && realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url))) {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const command = input.tool_input?.command;
  if (typeof command !== 'string') process.exit(0);

  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const cwd = input.cwd || projectDir;
  const reason = findViolation(command, { projectDir, cwd, currentBranch: () => currentBranch(cwd) });
  if (reason) {
    console.error(`Blocked by .claude/hooks/block-forbidden-commands.mjs: ${reason}`);
    process.exit(2);
  }
}

# E2E Buddy

A web dashboard plus a local Node.js service that lets a developer pick, run and debug Maestro flows on an
Android emulator or device with a prebuilt APK, without typing terminal commands.

**`docs/spec.md` is the source of truth.** Every issue links the spec sections it needs: read them before planning.
Out of scope for Phase 1 (spec §1.3): building APKs, iOS, Detox, parallel devices, booting AVDs, AI, login, cloud.

## Stack

| Layer    | Technology                                                                        |
| -------- | --------------------------------------------------------------------------------- |
| Language | TypeScript 6.0 (`strict`), Node.js 22+                                            |
| Monorepo | pnpm workspaces                                                                   |
| Server   | Fastify, Zod, `fast-glob`, `yaml`, `fast-xml-parser`                              |
| Web      | React 18, Vite, Tailwind, TanStack Query, React Router, `@tanstack/react-virtual` |
| Testing  | Vitest, fake `adb` / `maestro` binaries                                           |
| External | Maestro CLI, ADB (Android platform-tools), Java                                   |

## Repo layout

Planned layout from spec §2.2 (scaffolded by #2; until then most of it does not exist yet):

```text
e2e-buddy/                      # project root; launch Claude Code from here
├── apps/
│   ├── server/src/
│   │   ├── api/                # routes, auth guard, SSE
│   │   ├── core/               # process-runner, config, storage
│   │   ├── workspace/          # project registry, flow discovery
│   │   ├── android/            # ADB adapter
│   │   ├── maestro/            # Maestro adapter
│   │   ├── runs/               # orchestrator, device lock
│   │   ├── doctor/
│   │   └── artifacts/
│   └── web/src/
│       ├── pages/              # Workspace, RunConsole, History, Doctor, Settings
│       ├── components/
│       └── hooks/              # useRunEvents, useDevices
├── packages/contracts/         # shared Zod schemas + types
├── test/fixtures/bin/          # fake adb and maestro, tests only
└── docs/                       # spec.md, maestro-output.md, claude-notes.md
```

The adapters stay as folders in `apps/server/src/`. Do not move them to `packages/` in Phase 1.

## Commands

Node 22+ (`.nvmrc`), pnpm 11. Run everything from `e2e-buddy/`.

| Command        | What it does                                                               |
| -------------- | -------------------------------------------------------------------------- |
| `pnpm install` | Install dependencies                                                       |
| `pnpm dev`     | Server (`tsx watch`, :4477) + Vite (:5173, proxies `/api` to the server)   |
| `pnpm test`    | Vitest across all workspaces (fake binaries, no emulator needed)           |
| `pnpm lint`    | ESLint + Prettier check + `tsc` typecheck in every workspace               |
| `pnpm format`  | Prettier write                                                             |
| `pnpm build`   | Build the web app, then bundle the server (with contracts) via tsup        |
| `pnpm start`   | Serve the API and built web app on `http://127.0.0.1:4477` (after `build`) |

`packages/contracts` ships TypeScript source (no build step); Vite, tsx and tsup compile it.
Vite/Vitest run with `--configLoader runner` so `vite.config.ts` can import contracts; keep that flag.
CI (`../.gitlab-ci.yml`, repo root) runs lint, test and build on Node 22.

Runtime data lives in `~/.e2e-buddy/` (override with `E2E_BUDDY_HOME`): `config.json`, `projects.json`, `runs/<run-id>/`.

## Hard rules

1. **TypeScript `strict`, no `any`.** Use `unknown` + Zod parsing at the edges.
2. **Shared types live only in `packages/contracts`.** API request/response types, `TestRun`, `FlowRun`,
   `RunEvent`, `DoctorReport` etc. are Zod schemas there; server and web import them, never redeclare them.
3. **Every external command goes through `process-runner`.** `spawn(cmd, args)` with `shell: false` and an
   argument array built from validated data. No other module imports `child_process`. Never build command strings.
4. **Never fake or hardcode results.** A flow is `passed` only when Maestro exits 0. Fake binaries live only in
   `test/fixtures/bin/` and are reached only via test config. Production code has no demo mode.
5. **Validate at the API boundary.** The API takes IDs, never commands. `realpath` every path; APKs end in `.apk`
   and sit in `rootPath` or `allowedApkDirs`; `serial` must be in the latest `adb devices`; `appId` matches the
   Android package regex; `flowIds` belong to the project; env keys match `[A-Z0-9_]+`; artifact paths stay inside
   the run directory.
6. **Atomic writes for JSON state.** `run.json`, `projects.json` and `config.json` are written to a temp file in
   the same directory, then `rename`d. `events.jsonl` and logs are append-only streams; never hold full logs in memory.
7. **Local and private.** Bind `127.0.0.1` only. Require the session token and check `Host`/`Origin`. Mask env values
   whose key contains `PASSWORD`, `TOKEN`, `SECRET` or `KEY`. No telemetry, no network calls.

## Workflow

- One issue per branch: `feat/<iid>-<slug>`.
- Start with `/implement-ticket <iid>`: read the issue and its spec sections, propose a plan, and wait for approval
  before writing code.
- Check "Depends on" in the issue. If a dependency isn't in the repo yet, stop and say so.
- Stay in the issue's scope. Note follow-ups instead of doing them.
- Add or update tests for new behavior (unit for parsers and rules, integration with fake binaries for runs).
- Run `pnpm lint` and `pnpm test` before saying a ticket is done, and report the real output.
- Commit header: `[<iid>] <type>(<optional scope>): <subject>`, e.g. `[2] feat: add health endpoint`.
  Types come from Conventional Commits (`feat`, `fix`, `chore`, `docs`, `refactor`, `test`, ...).
- Husky enforces this: `pre-commit` runs `pnpm lint` (Prettier, ESLint, tsc) and `pnpm test`; `commit-msg` runs
  commitlint (`commitlint.config.js`). Fix the failure; never bypass with `--no-verify`.
- Claude Code hooks (`.claude/settings.json`, scripts in `.claude/hooks/`) check work as it happens:
  after every Edit/Write, `format-file.mjs` runs Prettier + `eslint --fix` on that file and reports what is left;
  before finishing, `check-changes.mjs` runs `pnpm typecheck` and `vitest related` on changed `.ts/.tsx` files.
  When a hook reports errors, fix them; don't work around the hook.
- Before opening an MR (`/create-mr`, target branch `dev`), run the `code-reviewer` subagent
  (`.claude/agents/code-reviewer.md`: correctness, design, readability, security, performance, tests) and
  `/review-ticket` (Hard rules + acceptance criteria). Fix blockers and majors first.
- Log what worked and what didn't in `docs/claude-notes.md`.

## Where things go

| Thing                                     | Location                                |
| ----------------------------------------- | --------------------------------------- |
| Shared types and Zod schemas              | `packages/contracts`                    |
| Spawning `maestro`, `adb`, `java`, `open` | `apps/server/src/core/process-runner`   |
| Fake `adb` / `maestro` for tests          | `test/fixtures/bin/`                    |
| Run data, logs, artifacts                 | `~/.e2e-buddy/runs/<run-id>/` (spec §4) |
| Maestro flags, output layout, exit codes  | `docs/maestro-output.md` (from #1)      |
| Status codes and error codes              | spec §3.3 and §9                        |

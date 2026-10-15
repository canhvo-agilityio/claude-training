# E2E Buddy

A web dashboard plus a local Node.js service that lets a developer pick, run and debug Maestro flows on an
Android emulator or device with a prebuilt APK, without typing terminal commands.

**`docs/spec.md` is the source of truth.** Every issue links the spec sections it needs: read them before planning.
Out of scope for Phase 1 (spec §1.3): building APKs, iOS, Detox, parallel devices, booting AVDs, AI, login, cloud.

## Stack

| Layer    | Technology                                                                        |
| -------- | --------------------------------------------------------------------------------- |
| Language | TypeScript 5 (`strict`), Node.js 20+                                              |
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

<!-- TODO(#2): confirm these once the monorepo is bootstrapped. -->

| Command        | What it does                                                     |
| -------------- | ---------------------------------------------------------------- |
| `pnpm install` | Install dependencies                                             |
| `pnpm dev`     | Server + Vite dev server (Vite proxies `/api` to the server)     |
| `pnpm test`    | Vitest across all workspaces (fake binaries, no emulator needed) |
| `pnpm lint`    | ESLint + Prettier check                                          |
| `pnpm build`   | Build contracts, server and web                                  |
| `pnpm start`   | Serve the API and built web app on `http://127.0.0.1:4477`       |

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
- Commit messages follow Conventional Commits and end with `Refs #<iid>`.
- Run `/review-ticket` before opening an MR (`/create-mr`, target branch `dev`).
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

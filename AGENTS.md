# Telegram Gallery - Agent Instructions

## What this project is
Browser-based photo/video gallery using Telegram as a storage backend.
Chrome desktop + Android Chrome (PWA). Client-only - no server.

## Tech stack
- Svelte 5 + TypeScript strict
- Vite
- @mtcute/web - Telegram MTProto client
- PhotoSwipe v5 - fullscreen viewer
- IndexedDB - thumbnail cache
- OPFS - full media cache (Phase 3+)

## SYSTEM BOUNDARIES - absolute hard rules

These rules override everything else. No exceptions. No creative interpretations.

1. **Working directory is the project root only.**
   Never `cd` outside it. Never read or write paths outside it.
   No `/tmp`, no `~/`, no absolute paths to other directories.
   Temporary files go in `./tmp/` (create it if missing; it is gitignored).

2. **Never install system-level tools.**
   No `apt`, `brew`, `yum`, `pip install` (outside a venv), `npm install -g`,
   `curl | bash`, or any command that modifies the host OS.

3. **Never modify system configuration.**
   No `/etc/`, no `~/.bashrc`, no `~/.gitconfig`, no system service files.

4. **No external access under any circumstances.**
   Never access external networks, remote services, web pages, APIs, package registries,
   or any resource outside the local project environment.

5. **All builds run inside Docker with `--network host`.**
   Docker networking is permanently disabled on this system.
   Every `docker run` must include `--network host`.
   Standard build pattern:
    ```
    docker run --rm --network host \
      -v "$(pwd)":/app -w /app \
      node:24-alpine <command>
    ```
    Dev server pattern (exposes port to host directly via host networking):
    ```
    docker run --rm --network host \
      -v "$(pwd)":/app -w /app \
      node:24-alpine npm run dev -- --host --port 5173
    ```

 6. **Temporary files use `./tmp/`, never system `/tmp/`.**
    `./tmp/` is gitignored. Create it with `mkdir -p ./tmp` if needed.

 7. **Dev server must always use port 5173. If port is in use, kill the process.**
    The test environment depends on consistent port 5173. Never allow the dev server
    to fall back to another port. Before starting dev server, ensure port 5173 is free.
    Example: `lsof -ti:5173 | xargs kill -9 2>/dev/null || true`



## Commit discipline

**Commit after every logical block of work. Do not batch multiple features into one commit.**

A "logical block" is any of:
- Completing a self-contained feature or sub-feature
- Fixing a bug
- Adding or updating tests
- Refactoring a module without changing behavior
- Updating config, docs, or tooling

Commit flow (mandatory before moving to the next block):
1. Run `npm run check` (type check) inside Docker unless the active task is explicitly limited to documentation-only work and code/test behavior is intentionally untouched.
2. Run the required short or long test gates when the touched logical block changes executable product behavior, test selectors/contracts, or test files.
3. Update `STATUS.md` with the logical block being completed, the current todo states, blockers/gaps affected by the work, and the latest validation result or explicit validation deferral.
4. Run `git add -A && git diff --cached --stat` to review what will be committed.
5. Commit with a Conventional Commits message: `type: subject` (max 72 chars).
   Types: `feat` | `fix` | `refactor` | `style` | `chore` | `docs` | `test`
6. Record the commit hash and completed block in `STATUS.md`.
7. Run `git status` to confirm clean working tree.

Never skip a commit to "do one more thing first."
Never use `--no-verify`.

## Code rules

6. **Adapter pattern**: never import `@mtcute/web` in feature code.
   All Telegram calls go through `src/lib/telegram/adapter.ts`.
7. **No console.log in production**: use `src/lib/debug.ts` (stripped in prod build).
 8. **URL lifecycle**: every `URL.createObjectURL()` must pair with `URL.revokeObjectURL()`.
 9. **No alert/confirm**: use the Toast store and component.
10. **TypeScript strict**: no `any`, no type assertions outside adapter files.
11. **Progressive jpeg**: every commit is a working, usable app. No stubs.

## Required workflow documents

### Document authority
- `APPLICATION_SPEC.md` is the architecture and supported-behavior source of truth.
- `STATUS.md` is the execution ledger for plans, todo states, blockers, validations, and commits.
- If code changes architecture, supported behavior, workflow gates, or accepted limitations, update `APPLICATION_SPEC.md`.
- If work changes plan state, todo state, validation state, blocker state, or commit state, update `STATUS.md`.

### Status ledger rules (mandatory)
- Read `STATUS.md` before starting non-trivial work.
- Register every new implementation plan in `STATUS.md` before starting execution.
- Record every todo state in `STATUS.md` using explicit states: `pending`, `in_progress`, `failed`, `completed`.
- Update `STATUS.md` immediately when a todo changes state.
- Record every validation run in `STATUS.md`, including command, pass/fail, and why it matters.
- If a validation is intentionally deferred because the task is documentation-only or blocked by scope, record the deferral and reason in `STATUS.md` immediately.
- Record every blocker, failed attempt, and spec/status drift worth tracking in `STATUS.md`.
- Record every completed logical block and every commit hash in `STATUS.md`.
- Do not claim a feature/flow is complete in `STATUS.md` unless the required validation has passed.

### Planning and execution rules
- Before non-trivial implementation, read `APPLICATION_SPEC.md`, `STATUS.md`, and the active plan file.
- If no active plan exists for non-trivial work, create one under `.kilo/plans/` and register it in `STATUS.md`.
- If `APPLICATION_SPEC.md`, `STATUS.md`, and the code disagree, reconcile the documents before claiming completion.
- Required test suites must contain executable assertions only. Do not satisfy process gates with commented-out, placeholder, or speculative tests.
- Unsupported behavior must be removed from required test claims and documented as a gap; do not hide it behind weakened completion claims.
- Documentation-only tasks must update the governing markdown files truthfully without silently claiming unrun validations or restored product behavior.
- After completing a phase, update `STATUS.md` 'Current Phase' and 'Next Execution Order' before moving to next phase.


## Architecture
src/lib/telegram/adapter.ts  <- TelegramAdapter interface (the only import contract)
src/lib/telegram/mtcute.ts   <- mtcute implementation of adapter
src/stores/                  <- Svelte writable stores (global state)
src/components/              <- Svelte components
src/App.svelte               <- root, screen switching via store
src/main.ts                  <- entry point

## State ownership
| State                 | Store            | Persisted              |
|-----------------------|------------------|------------------------|
| TelegramClient        | stores/telegram  | No (in-memory)         |
| Auth state            | stores/telegram  | session -> localStorage |
| Current dialog        | stores/gallery   | No                     |
| Loaded media items    | stores/gallery   | No                     |
| Scroll positions      | stores/gallery   | localStorage (Map)     |
| Gallery bookmarks     | stores/dialogs   | localStorage           |
| User settings         | stores/settings  | localStorage           |

## UI Testing Rules

### Test Suites
1. **Short Test** (`npm run test:short`): Required baseline coverage for currently supported flows
   - Authentication (phone/QR)
   - Dialog navigation and settings baseline
   - Gallery/viewer baseline only when those paths are currently supported and asserted for real
   - No placeholder assertions, no commented-out shells, no speculative checks

2. **Long Test** (`npm run test:long`): Extended coverage for advanced flows that are both implemented and currently claimed as supported
   - Include only executable assertions for real UI behavior
   - Remove or rewrite unsupported upload/download/share/cache/mobile expectations until those flows are actually restored

### When to Run Tests

#### Short Test (MANDATORY):
- ✅ After every logical block of work
- ✅ Before updating `APPLICATION_SPEC.md` when the edit changes supported behavior claims tied to executable validation
- ✅ Before completing a plan/phase
- ✅ On every commit
- ✅ Before moving to next task

#### Long Test (TRIGGER-BASED):
- 🔄 When changing authentication logic
- 🔄 When modifying navigation flows  
- 🔄 When updating core UI components
- 🔄 When changing data fetching logic
- 🔄 Before major releases
- 🔄 Manual trigger when needed
- 🔄 Only when the touched advanced flow is implemented end-to-end and claimed as supported in `APPLICATION_SPEC.md`

### Test Environment
- Real Playwright test files with assertions (not placeholder scripts)
- Always use mock adapter (`VITE_USE_MOCK_ADAPTER=true`)
- Sample data in `samples/` directory
- Run in headless mode for CI
- Test both desktop and mobile viewports
- MCP Playwright is for debugging only, not a substitute for automated tests

### Failure Handling
- Test failures MUST be addressed immediately
- Update tests if behavior changes intentionally
- Document test changes in commit messages
- Never skip tests to "save time"
- Record failing validations and their current disposition in `STATUS.md` immediately
- Do not replace failing required coverage with placeholders or weakened no-op assertions

### Kilo Commands
```bash
# Development workflow
kilo test:short    # Run short test suite
kilo test:long     # Run long test suite  
kilo test:all      # Run both suites

# CI/CD integration
kilo ci:test       # Run appropriate tests based on changes
```

### Docker Compose Test Setup
Compose files are split by purpose:
- `docker-compose.yml` is for the user's manual app-server workflow only and must not be treated as the default agent test stack.
- `docker-compose.test.yml` is the dedicated agent/Playwright test workflow.

For required Playwright validation, use the dedicated test compose file:
```bash
# Run tests using dedicated test compose
docker-compose -f docker-compose.test.yml up --build playwright

# Or run a specific suite/project
docker-compose -f docker-compose.test.yml run --rm playwright npx playwright test --config=playwright.config.ts --grep "@short" --project=desktop-chrome
```

Manual app serving for the user may use:
```bash
docker-compose up app
```

That manual compose path must keep real auth available and must not force mock mode.

**Never run `npm run test:short` directly in Docker** - it will try to launch both dev server and browser in same container, which conflicts with the proper separation.

## Reference files
- TESTING_STRATEGY.md          - Comprehensive testing strategy and requirements
- kilo-dev-process.md          - MVP architecture, function-level analysis
- TECHNICAL_MIGRATION_PLAN.md  - full plan with phases, flows, design spec
- STATUS.md                    - project status, progress tracking, plan cross‑references

## Status minimum sections
`STATUS.md` must keep these sections current:
- Active Plan
- Current Todo States
- Plan And Todo History
- Current Blockers And Known Gaps
- Spec/Status Drift
- Last Validation
- Recent Commit Log
- Next Execution Order

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
     node:20-alpine <command>
   ```
    Dev server pattern (exposes port to host directly via host networking):
    ```
    docker run --rm --network host \
      -v "$(pwd)":/app -w /app \
      node:20-alpine npm run dev -- --host --port 5173
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
1. Run `npm run check` (type check) inside Docker — fix any errors first.
2. Run `git add -A && git diff --cached --stat` to review what will be committed.
3. Commit with a Conventional Commits message: `type: subject` (max 72 chars).
   Types: `feat` | `fix` | `refactor` | `style` | `chore` | `docs` | `test`
4. Run `git status` to confirm clean working tree.

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
12. **Reference code is archived in legacy-archive branch**: original MVP code preserved in git history.

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
1. **Short Test** (`npm run test:short`): Basic flows only
   - Authentication (phone/QR)
   - Dialog navigation
   - Gallery view transitions
   - Basic UI interactions
   - No uploads/downloads/sharing
   - Timeout: 60 seconds max

2. **Long Test** (`npm run test:long`): Full coverage
   - All short test features PLUS:
   - Upload/download flows
   - Sharing functionality
   - Cache management
   - Error states
   - Mobile responsiveness
   - Performance testing
   - Timeout: 5 minutes max

### When to Run Tests

#### Short Test (MANDATORY):
- ✅ After every logical block of work
- ✅ Before updating APPLICATION_SPEC.md
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
The project uses Docker Compose for running tests:
- **App service**: Runs dev server on port 5173 with `VITE_USE_MOCK_ADAPTER=true`
- **Playwright service**: Waits for app to be ready, then runs tests against `https://localhost:5173`

**Important**: When running tests, use Docker Compose, not direct `npm run test:short`:
```bash
# Run tests using Docker Compose (correct way)
docker-compose up --build playwright

# Or to run specific test suite:
docker-compose run --rm playwright npx playwright test --config=playwright.config.ts --grep "@short" --project=desktop-chrome
```

**Never run `npm run test:short` directly in Docker** - it will try to launch both dev server and browser in same container, which conflicts with the proper separation.

## Reference files
- TESTING_STRATEGY.md          - Comprehensive testing strategy and requirements
- kilo-dev-process.md          - MVP architecture, function-level analysis
- TECHNICAL_MIGRATION_PLAN.md  - full plan with phases, flows, design spec
- legacy-archive branch        - original MVP code preserved in git history
- .kilo/status.md              - project status, progress tracking, plan cross‑references

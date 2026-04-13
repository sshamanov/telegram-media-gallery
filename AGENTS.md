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
     node:20-alpine npm run dev -- --host
   ```

6. **Temporary files use `./tmp/`, never system `/tmp/`.**
   `./tmp/` is gitignored. Create it with `mkdir -p ./tmp` if needed.

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

## Reference files
- kilo-dev-process.md           - MVP architecture, function-level analysis
- TECHNICAL_MIGRATION_PLAN.md   - full plan with phases, flows, design spec
- legacy-archive branch         - original MVP code preserved in git history
- .kilo/status.md               - project status, progress tracking, plan cross‑references

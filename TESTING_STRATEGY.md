# Telegram Gallery - Testing Strategy

## Purpose
Define the executable validation policy for Telegram Gallery. This document covers only real commands, real suites, real selectors, real assertions, and truthful accepted gaps.

## Document Role
- `TESTING_STRATEGY.md` defines how validation must be run and what counts as valid coverage.
- `APPLICATION_SPEC.md` defines which product behavior is currently supported.
- `.kilo/status.md` records the latest validation results, deferrals, blockers, and scope changes.
- If these documents disagree, reconcile them before claiming a suite or flow is complete.

## Core Rules
- Required suites must contain executable assertions only.
- Commented-out, placeholder, speculative, weakened, or aspirational tests do not satisfy process gates.
- If behavior is not currently supported, remove it from required test claims and document it as a gap in `APPLICATION_SPEC.md` and `.kilo/status.md`.
- `npm run check` is a required gate for every non-documentation logical block.
- Documentation-only work may defer code/test validation only when the deferral is explicitly recorded in `.kilo/status.md`.

## Test Stack
- **Framework**: Playwright
- **Runtime target**: local app served at `https://localhost:5173`
- **Mock mode**: `VITE_USE_MOCK_ADAPTER=true`
- **Projects**: `desktop-chrome`, `mobile-chrome`
- **Config**: `playwright.config.ts`

## Execution Model

### Docker Compose Workflow For Playwright
Use the dedicated test compose file so the app server and browser runner stay separated without affecting the user's manual compose workflow:

```bash
docker-compose -f docker-compose.test.yml up --build playwright

# Specific suite/project example
docker-compose -f docker-compose.test.yml run --rm playwright npx playwright test --config=playwright.config.ts --grep "@short" --project=desktop-chrome
```

Do not rely on direct `npm run test:short` execution inside a single Docker container for required Playwright validation.

`docker-compose.yml` is reserved for manual app-server usage and must not be used as the default agent test entry point.

### Docker Workflow For Type Check
```bash
docker run --rm --network host \
  -v "$(pwd)":/app -w /app \
  node:24-alpine npm run check
```

## Validation Gates

### Always Required For Non-Documentation Blocks
After every logical block that changes executable behavior, test files, or validation-sensitive UI contracts:
1. run `npm run check` in Docker
2. run the required short suite for the touched supported behavior
3. run the relevant long suite only if the touched advanced flow is implemented and currently claimed as supported
4. record the result in `.kilo/status.md`

### Documentation-Only Blocks
When the work is limited to markdown/process truth alignment and intentionally does not change code, tests, selectors, or supported executable behavior:
1. do not invent validation that was not run
2. record the validation deferral in `.kilo/status.md`
3. do not claim restored product behavior from documentation edits alone

## Suite Definitions

### Short Suite
**Purpose**: fast validation of currently supported baseline UI.

**Required coverage**:
- auth screen rendering
- phone auth flow
- QR screen rendering or QR baseline behavior that is actually implemented
- dialogs screen rendering and tab semantics
- settings open/close baseline
- gallery baseline only when the current status/spec accept it as supported
- viewer baseline only when the current status/spec accept it as supported

**Not allowed**:
- commented-out assertions
- no-op tests that only navigate without checking behavior
- assertions for unsupported download/share/upload/cache/mobile flows

### Long Suite
**Purpose**: extended validation of supported advanced flows only.

**Retention rule**:
- keep a long test only if the feature exists in real UI and `APPLICATION_SPEC.md` currently claims it as supported
- rewrite or remove long tests that depend on unsupported dialogs, menus, downloads, uploads, sharing, cache confirmations, or mobile-only UI that is not actually present

## Stable UI Contract For Tests

### Screen markers
- `data-testid="auth-screen"`
- `data-testid="dialogs-screen"`
- `data-testid="gallery-screen"`
- `data-testid="settings-screen"`

### Auth markers
- `phone-input`
- `send-code-button`
- `verification-code-input`
- `submit-code-button`
- `2fa-password-input`
- `submit-password-button`
- `auth-status`
- `qr-form`
- `qr-canvas`
- `qr-refresh-button`
- `qr-2fa-section`
- `qr-2fa-password-input`
- `qr-2fa-submit-button`

### Dialog markers
- `galleries-tab`
- `groups-tab`
- `chats-tab`
- `galleries-list`
- `groups-list`
- `chats-list`
- `dialog-search`
- `empty-galleries`
- `dialog-item`
- `dialog-toggle-button`

### Selector policy
- Do not invent selectors that are not present in the UI.
- Prefer stable hooks over text-only selectors when available.
- Conditional UI must be tested conditionally or with setup that truthfully makes it appear.

## Current Known Testing Gaps
1. Long Playwright specs still need pruning or rewrite so they cover executable supported flows only.
2. Any long spec expecting unsupported upload, download, share, forward, cache-confirmation, or mobile-menu UI must not remain a required claim.
3. Product and test truth must continue to be synchronized in `APPLICATION_SPEC.md` and `.kilo/status.md` whenever supported behavior changes.

## Failure Handling
- Treat required-suite failures as blocking for the affected logical block.
- Fix the product or rewrite the test only when the test no longer matches supported behavior.
- Never hide a failing requirement by replacing it with a weaker or placeholder assertion.
- Record failing validations and their current disposition in `.kilo/status.md` immediately.

## Agent Requirements
- Read `APPLICATION_SPEC.md` and `.kilo/status.md` before changing tests.
- Update `.kilo/status.md` whenever test scope, validation state, deferrals, blockers, or accepted gaps change.
- Record each validation command and result in `.kilo/status.md`.
- Never count a suite as useful coverage if the assertions are effectively empty.

## Success Criteria

### Short Suite Success
- Every required short test performs real assertions
- No required short test is a placeholder or commented-out shell
- Short suite matches supported baseline behavior described in `APPLICATION_SPEC.md`

### Long Suite Success
- Every retained long test covers a real supported advanced flow
- Unsupported advanced flows are documented as gaps instead of being hidden behind placeholder or stale assertions

## References
- `APPLICATION_SPEC.md`
- `.kilo/status.md`
- `AGENTS.md`
- `playwright.config.ts`
- `docker-compose.yml`

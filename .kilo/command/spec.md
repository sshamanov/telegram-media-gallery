---
description: Write a feature spec before implementing
agent: hard-route
---
Write a feature spec for: $ARGUMENTS

Before writing, read `APPLICATION_SPEC.md`, `.kilo/status.md`, and the active plan if one exists.
Register the new spec/plan work in `.kilo/status.md` before implementation begins.

Cover:
1. User-visible behavior (step-by-step, from the user's perspective)
2. Affected stores and components (filenames)
3. New TelegramAdapter methods needed, if any
4. Acceptance criteria - numbered checklist, each independently verifiable
5. Edge cases and error states

Reference existing current code and `APPLICATION_SPEC.md` for behavior to preserve.
Reference `TECHNICAL_MIGRATION_PLAN.md` only when it does not conflict with the current spec/status reality.
Do NOT write implementation code in this response.

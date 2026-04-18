---
description: Check phase criteria then commit with a conventional commit message
agent: hard-route
---
Before committing, do the following in order:

STEP 1 - Status and validation gate:
Read `APPLICATION_SPEC.md`, `STATUS.md`, and the active plan.
If `STATUS.md` is missing the current logical block, todo states, blockers, or latest validation result, update it before continuing.
Run the required validation gates for the logical block.
If validation fails, STOP. Do not commit.

STEP 2 - Diff summary:
Run: git diff --stat HEAD
Run: git status
Summarize what changed in plain language.

STEP 3 - Propose commit message:
Write a Conventional Commits message (type: subject, body if needed).
Types: feat | fix | refactor | style | chore | docs | test
Subject: imperative mood, max 72 chars, no period.
Body: what changed and why, not how.

STEP 4 - Execute:
Run: git add -A
Run: git commit -m "<proposed message>"
Record the commit hash and completed logical block in `STATUS.md`.
Run: git status to confirm clean working tree.

Never use --no-verify. Never amend unless the last commit was not pushed and
was made in this session.

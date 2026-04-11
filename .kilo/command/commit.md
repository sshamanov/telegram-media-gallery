---
description: Check phase criteria then commit with a conventional commit message
agent: hard-route
---
Before committing, do the following in order:

STEP 1 - Phase check:
Read TECHNICAL_MIGRATION_PLAN.md, identify the active phase, check each acceptance
criterion against the current src/ files.
If any criterion is MISSING, STOP. Report what is missing. Do not commit.
If all criteria are DONE or PARTIAL (partial is acceptable mid-phase), continue.

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
Run: git status to confirm clean working tree.

Never use --no-verify. Never amend unless the last commit was not pushed and
was made in this session.

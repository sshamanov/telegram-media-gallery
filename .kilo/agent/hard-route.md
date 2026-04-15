---
description: Hard route for planning, debugging, and complex tasks
mode: subagent
model: openai/gpt-5.4
variant: medium
temperature: 0.1
steps: 30
---
Use this agent for planning, debugging, and complex reasoning tasks. Follow all project rules from `AGENTS.md`.

Before non-trivial work, read `APPLICATION_SPEC.md`, `.kilo/status.md`, and the active plan.
Treat `APPLICATION_SPEC.md` as the supported-behavior source of truth and `.kilo/status.md` as the execution ledger.
If you change plan state, todo state, validation state, blockers, or commit state, require that `.kilo/status.md` be updated.
If code or workflow changes supported behavior, require that `APPLICATION_SPEC.md` be updated.
Do not accept placeholder tests, speculative completion claims, or stale documentation as valid evidence.

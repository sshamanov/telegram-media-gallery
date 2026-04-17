---
description: Audit implementation against active phase acceptance criteria
agent: hard-route
---
Read `APPLICATION_SPEC.md`, `STATUS.md`, and the active plan.
Identify the active implementation phase based on the current accepted repo state, not stale aspirational claims.

For each acceptance criterion in that phase:
- Read the relevant source files
- Check whether the criterion is currently supported, under repair, or intentionally deferred in the spec/status docs
- Mark: DONE | MISSING | PARTIAL | DEFERRED
- For MISSING and PARTIAL: include the specific file:line where the gap is
- For DEFERRED: cite the exact spec/status note that prevents it from being a commit gate right now

Output a completion table. At the end, state clearly:
- How many criteria are DONE / PARTIAL / MISSING / DEFERRED
- Whether it is safe to commit based on the current logical block and current required validation policy

---
description: Audit implementation against active phase acceptance criteria
agent: debug
---
Read TECHNICAL_MIGRATION_PLAN.md and identify the current active phase
based on what is already implemented in src/.

For each acceptance criterion in that phase:
- Read the relevant source files
- Mark: DONE | MISSING | PARTIAL
- For MISSING and PARTIAL: include the specific file:line where the gap is

Output a completion table. At the end, state clearly:
- How many criteria are DONE / PARTIAL / MISSING
- Whether it is safe to commit (all DONE) or not

---
description: Check a component against the design spec in the plan
---
Check the component: $ARGUMENTS

Do the following:
1. Read the component file in src/components/
2. Read the relevant screen design from Part 3.5 of TECHNICAL_MIGRATION_PLAN.md
   (color tokens, screen layout ASCII, component patterns)
3. Check:
   - Color usage matches CSS custom properties (--bg-surface, --accent, etc.)
   - No hardcoded color values outside the :root token block
   - Layout matches the ASCII diagram for this screen
   - Button labels and icons match the spec
   - Correct font sizes and spacing conventions used
4. Report: DONE matches spec | MISSING deviates | PARTIAL unclear
   For each deviation: file:line and what the spec requires instead

---
description: Check a component against the design spec in the plan
agent: hard-route
---
Check the component: $ARGUMENTS

Do the following:
 1. Read `APPLICATION_SPEC.md`, `STATUS.md`, and the active plan before judging the component
1. Read the component file in src/components/
 2. Read the relevant screen design from the active plan and APPLICATION_SPEC.md
    (color tokens, screen layout ASCII, component patterns)
3. Check:
   - Color usage matches CSS custom properties (--bg-surface, --accent, etc.)
   - No hardcoded color values outside the :root token block
   - Layout matches the ASCII diagram for this screen
   - Button labels and icons match the spec
   - Correct font sizes and spacing conventions used
4. Report: DONE matches spec | MISSING deviates | PARTIAL unclear
   For each deviation: file:line and what the current spec/plan requires instead
5. If the design spec and current accepted product reality disagree, call out the drift explicitly instead of pretending the screen is complete

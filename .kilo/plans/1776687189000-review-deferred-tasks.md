# Review Deferred Tasks & Identify Next Work

**Goal:** Review all deferred tasks from completed plans, evaluate their priority, and identify the next high‑priority work items for execution.

**Plan ID:** 1776687189000‑review‑deferred‑tasks  
**Created:** 2026‑04‑20 16:53:09 +02:00  
**Status:** pending  

## Context

The offline‑media browsing plan (`.kilo/plans/1776640073475‑offline‑media‑browsing.md`) has been completed with all 5 phases implemented and validated. The "Next Execution Order" in `STATUS.md` states: "Ready for next plan: Review remaining deferred tasks and identify next high‑priority work."

## Deferred Tasks Inventory

From `STATUS.md` Current Todo States:

### Playful Otter Plan
- `deferred` Task 10: Write unit tests (plan: `.kilo/plans/1776540483164‑task10‑write‑unit‑tests.md`) - deferred as low priority; existing Playwright coverage sufficient for current validation

### Happy Tiger Plan (Code Quality Hardening)
- `deferred` Block 5: Reduce repetitive focus‑trap logic in `GalleryGrid`
- `deferred` Block 6: Harden keyboard navigation guard  
- `deferred` Block 7: Optional cleanup of `bulk‑actions.ts`

### Kind Island Plan (Follow‑up Code Quality Improvement)
- `deferred` Block 6: Optional final polish (no clear cleanup needed)

### Silent Knight Plan (Code Quality Improvement)
- `deferred` Block 4: Reassess `bulk‑actions.ts` helper shape (current helper shape already the clearer local minimum)
- `deferred` Block 5: Optional local formatting normalization (not justified beyond touched safety fixes)

## Execution Order

### Phase 1: Inventory and Prioritization

**Objective:** Systematically review each deferred task, assess its value, and assign priority.

**Steps:**

1. **Review Task 10 (unit tests)**:
   - Read the existing plan: `.kilo/plans/1776540483164‑task10‑write‑unit‑tests.md`
   - Assess current test coverage (Playwright e2e vs unit tests)
   - Evaluate effort vs benefit
   - Decision: keep deferred, elevate priority, or schedule for implementation

2. **Review Happy Tiger deferred blocks**:
   - Block 5: Examine current `GalleryGrid` focus‑trap logic
   - Block 6: Review keyboard navigation guard implementation
   - Block 7: Examine `bulk‑actions.ts` current state
   - Determine if these still provide value or are truly unnecessary churn

3. **Review Kind Island Block 6**:
   - Assess if any "final polish" is actually needed
   - Document findings

4. **Review Silent Knight deferred blocks**:
   - Block 4: Verify `bulk‑actions.ts` helper shape is indeed the clearer local minimum
   - Block 5: Confirm formatting normalization is not justified

5. **Create priority matrix**:
   - High: Must do (clear value, low risk)
   - Medium: Should do (good value, moderate effort)  
   - Low: Could do (minor improvements)
   - Defer: No clear value or high risk of churn

### Phase 2: Implementation Planning

**Objective:** Create detailed implementation plans for high‑priority items.

**Steps:**

1. **For each high‑priority item**:
   - Create detailed implementation plan
   - Estimate effort
   - Define success criteria
   - Identify files to modify

2. **Update `STATUS.md`**:
   - Update todo states based on prioritization
   - Record decisions and rationale
   - Set up next execution order

### Phase 3: Validation

**Objective:** Ensure prioritization decisions are sound and documented.

**Steps:**

1. **Run type check**: `npm run check`
2. **Run short test suite**: `npm run test:short`
3. **Update documentation**: Ensure `STATUS.md` reflects new priorities
4. **Commit**: Conventional commit with plan completion

## Success Criteria

- All deferred tasks reviewed and categorized by priority
- Clear rationale documented for each decision
- High‑priority items have detailed implementation plans
- `STATUS.md` updated with new todo states and next execution order
- No regression in existing functionality (type check passes, tests pass)

## Files to Modify

- `STATUS.md` (update todo states, add plan reference, update next execution order)
- Possibly create new implementation plan files for high‑priority items

## Estimated Effort

- **Phase 1 (inventory)**: 1‑2 hours
- **Phase 2 (planning)**: 1‑2 hours  
- **Phase 3 (validation)**: 0.5‑1 hour
- **Total**: 2.5‑5 hours

## Notes

- Follow existing commit discipline
- Be conservative: don't elevate deferred tasks without clear value
- Prioritize stability and maintainability over cosmetic improvements
- Consider the project's current state: offline features just completed, system is stable
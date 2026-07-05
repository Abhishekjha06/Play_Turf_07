# PlayTurf Priority Matrix

> **Version:** 1.0 | **Updated:** 2025-07-05 | **Framework:** Impact vs. Risk

---

## Matrix Overview

```
            High Risk
                |
    Q2          |          Q1
  (Avoid)       |    (Plan Carefully)
                |
Low Impact -----+----- High Impact
                |
    Q3          |          Q4
  (Deprecate)   |    (Do First)
                |
            Low Risk
```

---

## Q1: High Impact, High Risk — Plan Carefully

| ID | Item | Effort | Phase | Strategy |
|----|------|--------|-------|----------|
| Q1-1 | TurfCard theme unification | 4h | 4B | Feature branch; visual regression; split test |
| Q1-2 | CompactTurfCard theme unification | 3h | 4C | Same as Q1-1 |
| Q1-3 | Color token migration (all hex -> CSS vars) | 8h | 4A | Token-first approach; test both themes after each component |
| Q1-4 | BottomNav merge (Premium + Legacy) | 4h | 4E | High-touch UI; dogfood on staging |

**Strategy:** These require careful planning, feature branches, and thorough visual regression testing. Do one at a time with validation between each.

---

## Q2: Low Impact, High Risk — Avoid or Defer

| ID | Item | Effort | Notes |
|----|------|--------|-------|
| Q2-1 | Landscape-specific layouts | 4h | Low usage; complex implementation |
| Q2-2 | Desktop sidebar navigation | 6h | Not a mobile app need |
| Q2-3 | Advanced keyboard shortcuts | 2h | Power-user feature; low adoption |
| Q2-4 | Print stylesheet for receipts | 3h | PDF generation exists |

**Strategy:** Defer until after core modernization. These add complexity without proportional value for a mobile-first app.

---

## Q3: Low Impact, Low Risk — Deprecate / Background

| ID | Item | Effort | Notes |
|----|------|--------|-------|
| Q3-1 | Remove unused animation keyframes | 15min | `shimmer`, `float` in tailwind.config.ts |
| Q3-2 | Standardize border radius values | 1h | Low visual impact |
| Q3-3 | Replace `min-[360px]:` with `sm:` | 30min | Non-standard breakpoint |
| Q3-4 | Clean up `nul` / temp files | 5min | Housekeeping |

**Strategy:** Batch these into a single "cleanup" PR. Low risk, can be done anytime.

---

## Q4: High Impact, Low Risk — Do First

| ID | Item | Effort | Phase | Priority |
|----|------|--------|-------|----------|
| Q4-1 | Fix premium teal color contrast | 4h | 5 | **P0** — WCAG violation |
| Q4-2 | Add `aria-labelledby` to Dialog | 1h | 5 | **P0** — WCAG violation |
| Q4-3 | Fix dialog close button size (32px -> 44px) | 15min | 5 | **P1** — WCAG violation |
| Q4-4 | Fix admin delete button size | 15min | 5 | **P1** — WCAG violation |
| Q4-5 | Add `aria-label` to header notification bell | 15min | 5 | **P1** — Missing accessible name |
| Q4-6 | Fix input hardcoded text color | 30min | 4A | **P1** — Theme breakage risk |
| Q4-7 | Standardize booking component typography | 4h | 6 | **P2** — Consistency |
| Q4-8 | Apply `text-balance` to headings | 2h | 6 | **P2** — Readability |

**Strategy:** These are quick wins with high accessibility and maintainability impact. Batch the small ones (15-30min) into a single PR.

---

## Recommended Execution Order

### Sprint 1: Quick Wins (Week 1)
1. Q4-3: Dialog close button 44px
2. Q4-4: Admin delete button 44px
3. Q4-5: Header bell aria-label
4. Q4-2: Dialog aria-labelledby
5. Q4-6: Input text color fix

### Sprint 2: Theme Foundation (Week 1-2)
6. Q4-1: Premium teal contrast
7. Q1-3: Color token migration (Phase 4A)

### Sprint 3: Component Unification (Week 2-3)
8. Q1-1: TurfCard unification (4B)
9. Q1-2: CompactTurfCard unification (4C)
10. Q1-4: BottomNav merge (4E)

### Sprint 4: Polish (Week 4)
11. Q4-7: Booking typography standardization
12. Q4-8: text-balance on headings
13. Q3-1 to Q3-4: Cleanup items

---

## Decision Framework

When prioritizing new work, ask:

1. **Is it a WCAG violation?** → P0, do immediately
2. **Does it affect all users?** → High impact
3. **Can it break existing functionality?** → High risk
4. **Is it a quick fix (< 30min)?** → Batch with other quick wins
5. **Does it unblock other work?** → Prioritize
6. **Is it user-facing?** → Higher priority than internal cleanup

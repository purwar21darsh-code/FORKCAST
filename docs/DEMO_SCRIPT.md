# FORKCAST Demo Script

## Video Duration: 3-5 minutes

---

### Scene 1: Introduction (30s)

**Visual:** FORKCAST dark engineering workstation interface

**Narration:**
"Every plan fails. The question isn't whether — it's when, and whether you'll notice in time.

FORKCAST is a counterfactual planning engine. It doesn't just make a plan — it breaks it before reality does."

---

### Scene 2: The Request (30s)

**Visual:** Request composer with the demo prompt

**Action:** Type or show the pre-filled request:
> "Prepare my home for six guests at 6 PM. Check inventory, build a schedule and test whether the plan survives unexpected problems."

**Narration:**
"We start with a simple request: dinner for six at 6 PM. FORKCAST models the entire world — ingredients, resources, task dependencies, and deadlines."

---

### Scene 3: Baseline Schedule (45s)

**Action:** Click "Generate & Stress-Test Plan"

**Visual:** 
- MCP connection status shows green
- Baseline timeline renders with amber (critical) and cyan (parallel) bars
- Dependency graph appears

**Narration:**
"The engine generates a baseline schedule. Seven tasks, dependency-aware, respecting resource constraints. The critical path runs through marinating, cooking the curry, and final plating.

Notice the MCP tools being discovered — this is a real protocol integration. Every action goes through the Model Context Protocol."

**Key metrics shown:**
- Completion time: T+140min
- Deadline: T+360min (18:00)
- Buffer: 220 minutes
- Status: FEASIBLE

---

### Scene 4: Fault Injection (60s)

**Action:** Click "Run All Fault Scenarios"

**Visual:** Four scenario cards appear with comparison bars

**Narration:**
"Now we inject four real faults:

1. **Delivery Delay** — the heavy cream arrives 30 minutes late. The curry must wait.
2. **Ingredient Unavailable** — saffron is missing from inventory. Rice can't be cooked as planned.
3. **Task Overrun** — the curry takes 50% longer. The critical path extends.
4. **Resource Unavailable** — the oven breaks. Naan can't be warmed.

Each scenario is simulated independently on an isolated state copy. The original world is never touched."

**Visual highlights:**
- Show red FAILED badges on faulted scenarios
- Show violation counts
- Show completion time comparisons

---

### Scene 5: Repair Analysis (60s)

**Action:** Select a failed scenario (e.g., "Ingredient Unavailable")

**Visual:** Repair workspace appears with changes, trade-offs, and feasibility

**Narration:**
"For each failure, FORKCAST attempts a repair.

When saffron is unavailable, the engine switches to an alternative meal — Pasta Carbonara. All required ingredients are available. The repair is feasible.

When the oven breaks, non-critical tasks are skipped. The plan still completes on time.

But some faults have no repair — and FORKCAST tells you honestly."

**Key metrics shown:**
- Changes applied
- Trade-offs acknowledged
- Repair feasibility: ✓ or ✗

---

### Scene 6: Approval & Commit (30s)

**Action:** Click "Approve & Commit"

**Visual:** Green confirmation appears

**Narration:**
"Only after reviewing the repair — seeing the changes, the trade-offs, and the projected outcome — can you approve.

The commit is gated. Duplicate commits are rejected. The world version increments. And nothing happens in the real world — this is a simulation."

---

### Scene 7: FAULTLINE Library (30s)

**Action:** Click "FAULTLINE Report" button

**Visual:** Modal with test report output

**Narration:**
"Under the hood, FORKCAST uses FAULTLINE — an independent, open-source TypeScript library for failure simulation.

It provides state isolation, deterministic replay, and structured reporting. Any developer can use it to test their own plans against failures."

---

### Scene 8: Closing (15s)

**Visual:** Full interface with all panels populated

**Narration:**
"FORKCAST: Don't just make a plan. Break it before reality does."

---

## Demo Checklist

- [ ] MCP connection established
- [ ] World inspection shows inventory and resources
- [ ] Baseline plan generated and visualized
- [ ] Dependency graph rendered
- [ ] All four fault scenarios simulated
- [ ] At least one repair shown as feasible
- [ ] At least one repair shown as infeasible (honest)
- [ ] Commit approved with version increment
- [ ] FAULTLINE report displayed
- [ ] Activity log shows all operations
- [ ] Reset returns to seed state

# Product Feedback

## Developer Experience

### What Worked Well

1. **TypeScript type safety** — Catching type mismatches at compile time prevented many runtime errors in the scheduler and fault engine.

2. **Deterministic simulation** — Having no external dependencies (no AI APIs, no databases) made the system predictable and easy to debug.

3. **Separation of concerns** — Keeping FAULTLINE independent from FORKCAST-specific logic made both easier to test and reason about.

4. **MCP tool structure** — Defining tools with explicit input schemas made the API surface clear and testable.

### Challenges Encountered

1. **Scheduler complexity** — The resource conflict resolution required bounded iteration to avoid infinite loops. Finding the right search limit (100 iterations) required testing.

2. **Repair strategy design** — Deciding which repairs to attempt (reschedule vs. compress vs. meal switch) required understanding the domain deeply.

3. **State isolation** — Ensuring the original world is never mutated required careful cloning at every boundary. JSON deep clone works but has limitations with functions and circular references.

4. **UI state management** — Coordinating multiple async operations (MCP calls) with UI state required careful loading/error handling.

### What I'd Do Differently

1. **Add more test scenarios** — The current four faults are a good start, but compound faults (multiple simultaneous failures) would be more realistic.

2. **Better visualization** — The timeline could show resource utilization over time, not just task bars.

3. **Undo/redo** — Currently, reset is the only way to go back. A proper undo stack would improve exploration.

4. **Export results** — Adding the ability to export simulation reports as JSON or PDF would help with documentation.

## User Experience Observations

### First Impression
- The dark engineering workstation aesthetic communicates "serious tool" immediately
- The request composer is familiar (looks like a chat input) but the action is different (generates a plan, not a chat response)

### Workflow Clarity
- The phase indicator (READY → PLANNING → TESTING → etc.) helps users understand where they are
- The workflow pipeline at the bottom shows the full process at a glance
- Tool discovery via MCP is shown but might not be meaningful to non-technical users

### Pain Points
- Users might not understand why they need to "approve" a plan (what does it do?)
- The dependency graph is informative but might be overwhelming at first
- The FAULTLINE report is a separate concept that needs explanation

### Suggestions for Improvement
1. Add tooltips explaining technical terms (MCP, critical path, slack)
2. Provide a guided tour for first-time users
3. Make the commit action more clearly connected to "what happens next"
4. Show a before/after comparison more prominently

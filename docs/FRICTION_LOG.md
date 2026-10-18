# Friction Log

> Only genuine developer friction is recorded. No fabricated issues.

## Entry 1: Scheduler Resource Conflict Resolution

**Tool:** Custom scheduler engine
**Date:** Development session
**Severity:** Medium

**Reproduction:**
1. Create tasks that share a resource (e.g., two tasks needing "stove-burner-1")
2. Run the scheduler
3. Observe the resource conflict resolution loop

**Expected:** Tasks sharing a resource are sequenced without overlap.
**Actual:** The loop-based resolution works but required setting a bounded iteration limit (100) to prevent infinite loops in edge cases.

**Workaround:** Added max iteration counter with early exit.
**Suggestion:** Consider a priority-queue based approach for resource scheduling instead of iterative retry.

---

## Entry 2: JSON Deep Clone Limitations

**Tool:** World model state cloning
**Severity:** Low

**Reproduction:**
1. Call `cloneWorld()` on a WorldState object
2. Verify the clone is independent

**Expected:** Complete deep copy with no shared references.
**Actual:** JSON.parse(JSON.stringify()) works for plain data but would fail with functions, undefined values, or circular references.

**Workaround:** Current data model uses only serializable types (strings, numbers, arrays, plain objects).
**Suggestion:** For production, use structuredClone() or a proper deep-clone library.

---

## Entry 3: MCP Client Simulated Transport

**Tool:** MCP protocol layer
**Severity:** Medium (for production)

**Reproduction:**
1. Initialize MCP client
2. Call a tool

**Expected:** Real HTTP request to MCP server endpoint.
**Actual:** Client calls handler functions directly with simulated latency. No actual HTTP transport.

**Workaround:** The protocol logic (tool definitions, discovery, invocation, error handling) is real. Only the transport is simulated.
**Suggestion:** For production, integrate with the official MCP TypeScript SDK's StreamableHTTPClientTransport.

---

## Entry 4: Timeline Rendering Performance

**Tool:** React timeline visualization
**Severity:** Low

**Reproduction:**
1. Generate a plan with 7+ tasks
2. Observe timeline rendering

**Expected:** Smooth rendering with accurate positioning.
**Actual:** Works well for small task sets. The percentage-based positioning is simple but might not handle very large schedules optimally.

**Workaround:** Current demo has 7 tasks — well within rendering capabilities.
**Suggestion:** For larger schedules, consider virtualization or canvas-based rendering.

---

## Entry 5: Dependency Graph Layout

**Tool:** SVG dependency graph
**Severity:** Low

**Reproduction:**
1. View the dependency graph panel
2. Observe node positioning

**Expected:** Clean, readable graph layout.
**Actual:** Simple level-based layout works for the demo's 7 tasks. Complex graphs with many cross-level dependencies would need a proper layout algorithm (e.g., Sugiyama).

**Workaround:** Level computation via recursive DFS with cycle protection.
**Suggestion:** Integrate dagre or elk.js for production-quality graph layout.

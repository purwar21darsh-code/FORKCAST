# FORKCAST Architecture

## System Overview

FORKCAST is a counterfactual planning engine that operates entirely in the browser. It uses a deterministic world model, dependency-aware scheduling, fault injection, and repair planning — all without external API dependencies.

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (React)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │  UI Layer    │  │  MCP Client  │  │  FAULTLINE Library    │ │
│  │  (React)     │←→│  (Protocol)  │  │  (Reusable)           │ │
│  └──────────────┘  └──────┬───────┘  └───────────────────────┘ │
│                           │                                     │
│  ┌────────────────────────▼──────────────────────────────────┐ │
│  │                    MCP Tool Handlers                       │ │
│  │  inspect_world │ draft_plan │ simulate │ compare │ repair  │ │
│  └────────────────────────┬──────────────────────────────────┘ │
│                           │                                     │
│  ┌────────────────────────▼──────────────────────────────────┐ │
│  │                   ENGINE LAYER                              │ │
│  │  ┌────────────┐  ┌─────────────┐  ┌──────────────────┐   │ │
│  │  │  World     │  │  Scheduler  │  │  Fault Engine    │   │ │
│  │  │  Model     │  │  (DAG +     │  │  (Inject +       │   │ │
│  │  │  (Seed 42) │  │  Resources) │  │   Repair)        │   │ │
│  │  └────────────┘  └─────────────┘  └──────────────────┘   │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. World Model (`engine/worldModel.ts`)

A deterministic seeded state representing a household scenario:

- **Inventory:** 20 ingredients with availability times
- **Resources:** 5 kitchen resources (burners, oven, counter, chef)
- **Tasks:** 7 preparation tasks with dependencies and durations
- **Meals:** 2 options (Chicken Curry Feast, Pasta Carbonara)
- **Deadline:** 360 minutes (6 hours from noon = 18:00)

State is cloned via `JSON.parse(JSON.stringify())` for isolation.

### 2. Scheduler (`engine/scheduler.ts`)

A dependency-aware scheduling algorithm:

1. **Cycle Detection:** DFS-based cycle detection in the dependency graph
2. **Topological Sort:** Orders tasks respecting dependencies, prioritizing critical path
3. **Resource Scheduling:** Assigns start times respecting resource capacity constraints
4. **Ingredient Checking:** Validates ingredient availability at scheduled start times
5. **Deadline Validation:** Checks if completion time exceeds the deadline

**Algorithm:** Modified critical-path method with bounded resource conflict resolution (max 100 iterations per task).

### 3. Fault Engine (`engine/faultEngine.ts`)

Implements four deterministic fault types:

| Fault | Mechanism | Effect |
|---|---|---|
| DELIVERY_DELAY | Sets `availableAt` on ingredient | Task must wait for delivery |
| INGREDIENT_UNAVAILABLE | Sets quantity to 0, availableAt to ∞ | Task cannot proceed |
| TASK_OVERRUN | Multiplies task duration | Extends critical path |
| RESOURCE_UNAVAILABLE | Sets resource `available` to false | Task cannot use resource |

**Repair Strategies:**
- **Reschedule:** Reorder independent tasks to maximize parallel work
- **Task Compression:** Reduce non-critical task durations by 20%
- **Task Removal:** Skip non-critical tasks that need unavailable resources
- **Meal Switch:** Replace infeasible meal with alternative (Pasta Carbonara)

### 4. FAULTLINE Library (`faultline/index.ts`)

A reusable, framework-agnostic library for scenario matrix testing:

```typescript
runScenarioMatrix<TState, TOutcome>({
  initialState,       // Original state (never mutated)
  cloneState,         // Deep clone function
  simulateInSandbox,  // Run simulation on cloned state
  evaluateOutcome,    // Compare against baseline
  scenarios,          // Array of fault definitions
})
```

**Guarantees:**
- State isolation between scenarios
- Deterministic replay
- Exception containment
- Input validation

### 5. MCP Protocol Layer (`mcp/server.ts`)

Implements the Model Context Protocol tool definitions and handlers:

- **Server State:** Manages world state, scenario results, committed plans, activity log
- **Tool Handlers:** Each tool calls tested domain functions
- **Client:** Browser-side MCP client with initialization, tool discovery, and invocation
- **Commit Gate:** Requires explicit approval, prevents duplicate commits

## Data Flow

```
User Request
    │
    ▼
[MCP Client] ──callTool──→ [Tool Handler]
                              │
                    ┌─────────┼─────────┐
                    ▼         ▼         ▼
              [World Model] [Scheduler] [Fault Engine]
                    │         │         │
                    └─────────┼─────────┘
                              ▼
                      [SimulationOutcome]
                              │
                              ▼
                        [UI Renders]
                    (Timeline, Graph, Comparison)
```

## Key Design Decisions

1. **Deterministic by default:** No randomness, no external APIs, no date-dependent logic
2. **State isolation:** All simulations operate on cloned state; original is never mutated
3. **Explicit commit:** No changes are applied without user approval
4. **Honest reporting:** Infeasible plans are never hidden; failures are reported clearly
5. **Bounded computation:** Search limits prevent infinite loops in scheduling
6. **Separation of concerns:** FAULTLINE is independent; FORKCAST uses it as a dependency

## Limitations

- No persistent storage (state resets on page refresh)
- MCP is protocol-logic only (no actual HTTP transport in this build)
- Repair strategies are heuristic, not optimal
- No multi-user support
- No real-world integration (demo data only)

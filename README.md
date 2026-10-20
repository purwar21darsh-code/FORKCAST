# FORKCAST

**"Don't just make a plan. Break it before reality does."**

A deterministic counterfactual planning engine that models a world, generates a plan, injects disruptions, calculates failures, compares outcomes, and tests repairs before execution.

## What It Does

FORKCAST answers the question: "What happens when reality doesn't match my plan?"

Given a household scenario (e.g., "Prepare dinner for 6 guests at 6 PM"), FORKCAST:

1. **Models the world** — inventory, resources, task dependencies, deadlines
2. **Generates a baseline schedule** — deterministic, dependency-aware scheduling
3. **Injects faults** — delivery delays, missing ingredients, task overruns, resource failures
4. **Simulates impact** — calculates constraint violations and deadline failures
5. **Attempts repairs** — reorders tasks, switches meals, compresses schedules
6. **Compares outcomes** — baseline vs. faulted vs. repaired
7. **Requires approval** — explicit commit gate before any state change

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS 4
- **Engine:** Custom deterministic scheduler with dependency-aware topological sort
- **Fault Simulation:** FAULTLINE library (embedded, reusable)
- **Protocol:** MCP (Model Context Protocol) tool definitions and client
- **Visualization:** SVG dependency graph, CSS timeline bars

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Type check
npm run typecheck
```

## Architecture

```
src/
├── engine/
│   ├── types.ts          # Core type definitions
│   ├── worldModel.ts     # Deterministic seeded world state
│   ├── scheduler.ts      # Dependency-aware task scheduler
│   └── faultEngine.ts    # Fault injection and repair planner
├── faultline/
│   └── index.ts          # FAULTLINE reusable library
├── mcp/
│   └── server.ts         # MCP protocol layer (tools + client)
├── App.tsx               # Main application UI
├── main.tsx              # Entry point
└── index.css             # Tailwind + custom styles
```

## The Four Fault Scenarios

| ID | Type | Description |
|---|---|---|
| `delivery-delay` | DELIVERY_DELAY | Heavy cream delivery delayed by 30 minutes |
| `ingredient-unavailable` | INGREDIENT_UNAVAILABLE | Saffron threads missing from inventory |
| `task-overrun` | TASK_OVERRUN | Chicken curry takes 50% longer than expected |
| `resource-unavailable` | RESOURCE_UNAVAILABLE | Oven is broken — cannot warm naan bread |

## MCP Tools

| Tool | Description |
|---|---|
| `forkcast.inspect_world` | Inspect current world state |
| `forkcast.draft_plan` | Generate baseline schedule |
| `forkcast.list_scenarios` | List available fault scenarios |
| `forkcast.simulate_scenario` | Apply fault and simulate impact |
| `forkcast.compare_scenarios` | Compare all scenarios with repairs |
| `forkcast.repair_plan` | Attempt plan repair |
| `forkcast.commit_approved_plan` | Commit approved plan (requires approval) |

## FAULTLINE Library

FAULTLINE is an independent, reusable TypeScript library for simulating failures:

```typescript
import { runScenarioMatrix, formatReport } from './faultline';

const report = runScenarioMatrix({
  initialState: myState,
  cloneState: (s) => JSON.parse(JSON.stringify(s)),
  simulateInSandbox: (state) => mySimulator(state),
  evaluateOutcome: (outcome, baseline) => compare(outcome, baseline),
  scenarios: [
    { id: 'fault-1', name: 'Test Fault', description: '...', applyFault: (s) => modifyState(s) },
  ],
});

console.log(formatReport(report));
```

### Guarantees

- Original state is never mutated
- Each scenario operates on an independent clone
- Results are deterministic given the same inputs
- Exceptions in simulation are caught and reported
- Input validation with clear error messages

## Demo Scenario

The default demo models preparing a **Chicken Curry Feast** for 6 guests:

- **7 tasks** with dependencies (prep → cook → plate)
- **20 ingredients** including delayed deliveries
- **5 resources** (stove burners, oven, prep counter, chef)
- **Alternative meal:** Pasta Carbonara (for repair scenarios)
- **Deadline:** 18:00 (T+360 minutes from noon)

## Limitations

- All simulation is deterministic and local — no external API calls
- MCP is implemented client-side (protocol logic, not network transport)
- No real-world actions (purchases, bookings, device control)
- Repair strategies are bounded (task reorder, meal switch, compression)
- No persistent storage beyond browser session

## License

MIT

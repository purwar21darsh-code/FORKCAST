# FORKCAST — Product Description

## The Problem

Plans fail. Not because they're bad, but because reality is unpredictable.

When you're hosting six guests at 6 PM, you need to:
- Check what ingredients you have
- Schedule preparation tasks with dependencies
- Account for resource constraints (only 2 stove burners)
- Handle the unexpected (delivery delays, broken equipment)

Most planning tools give you a schedule. None tell you whether it will survive contact with reality.

## The Solution

FORKCAST is a counterfactual planning engine. It:

1. **Models your world** — inventory, resources, task dependencies, deadlines
2. **Generates a baseline plan** — dependency-aware, resource-constrained scheduling
3. **Breaks it** — injects four types of real-world failures
4. **Measures the damage** — calculates constraint violations and deadline misses
5. **Repairs it** — reorders tasks, switches meals, compresses schedules
6. **Shows you the truth** — honest comparison of baseline, failure, and repair

## How It Works

### The Engine

FORKCAST uses a deterministic scheduler that:
- Detects dependency cycles (and refuses to schedule them)
- Computes earliest start times from task dependencies
- Respects resource capacity constraints
- Validates ingredient availability at scheduled times
- Calculates slack, lateness, and critical path

### The Faults

Four fault types, each with measurable impact:

| Fault | What Happens | Measurable Effect |
|---|---|---|
| Delivery Delay | Ingredient arrives late | Task start delayed, possible deadline miss |
| Ingredient Missing | Required item unavailable | Task blocked, possible meal switch needed |
| Task Overrun | Task takes 50% longer | Critical path extended, buffer reduced |
| Resource Down | Equipment unavailable | Task cannot execute, possible skip needed |

### The Repairs

When a fault causes failure, FORKCAST attempts repair:
- **Reschedule:** Move independent tasks to fill gaps
- **Compress:** Reduce non-critical task durations
- **Skip:** Remove non-critical tasks that need broken resources
- **Switch:** Replace infeasible meal with a valid alternative

Not all failures are repairable. FORKCAST tells you honestly when no repair exists.

### The Protocol

All operations go through MCP (Model Context Protocol) tools:
- Every action is logged
- The original world is never mutated during simulation
- Committing requires explicit approval
- Duplicate commits are rejected

## Demo Scenario

**Request:** "Prepare my home for six guests at 6 PM."

**World:**
- 20 ingredients (some with delayed availability)
- 5 resources (2 burners, oven, prep counter, chef)
- 7 tasks with dependencies
- 2 meal options (Chicken Curry Feast, Pasta Carbonara)
- Deadline: 18:00

**Expected Results:**
- Baseline: Feasible, completes at T+140min (220min buffer)
- Delivery Delay: Feasible with rescheduling (cream arrives at T+30)
- Ingredient Unavailable: Infeasible → repair via meal switch to Carbonara
- Task Overrun: Feasible (absorbed by slack)
- Resource Unavailable: Repairable by skipping non-critical naan warming

## What Makes It Different

1. **Deterministic:** No AI hallucination. Every result is computed.
2. **Honest:** Infeasible plans are never hidden.
3. **Isolated:** Simulation never touches the original state.
4. **Gated:** No changes without explicit approval.
5. **Reusable:** FAULTLINE library works for any domain.

## Technical Highlights

- Dependency-aware scheduling with cycle detection
- Bounded resource conflict resolution
- State isolation via deep cloning
- MCP protocol integration
- SVG dependency graph visualization
- Real-time timeline rendering from computed data
- Activity logging of all operations

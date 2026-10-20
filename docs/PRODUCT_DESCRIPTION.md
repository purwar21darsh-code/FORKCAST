# FORKCAST — product description

## One-line summary

**FORKCAST stress-tests a planned future before a person commits to it.**

## The user problem

An assistant or planning tool can produce a schedule that looks reasonable and still fail when reality changes: a delivery is late, an ingredient is missing, a task overruns, or a resource goes offline.

Most planning demos stop at the happy path. They generate a plan, describe it confidently, and leave the user to discover the failure in the real world.

## The solution

FORKCAST models a small household, calculates a schedule, creates isolated counterfactual branches for defined disruptions, calculates the resulting constraint violations, searches defined alternatives for a repair, and verifies the repair with a second scheduler pass.

The user sees:

- the exact baseline timeline and dependency graph;
- which constraints the plan promises to satisfy;
- what each fault does to starting times and completion;
- which hard constraints newly break;
- why the repair works and what changes;
- exactly which local data would change;
- an explicit approval step;
- a persisted record of what actually happened.

For the judged demonstration, the scenario is fixed: prepare a home for six guests at 6:00 PM. The baseline roast-chicken plan finishes at 5:35 PM with 25 minutes of slack. A 30-minute chilled-delivery delay moves completion to 6:05 PM. The verified paneer-curry repair finishes at 5:32 PM, 28 minutes before the deadline. An unavailable dishwasher produces a real "no repair needed" result because only an optional task is omitted.

## What makes it different

- **The schedule is calculated, not narrated.** Dependencies, resource capacity, ingredient availability and the guest deadline are enforced by code.
- **The branch is isolated, not simulated in prose.** FAULTLINE clones the world for each fault. The original demo state is not mutated.
- **A repair must survive a second calculation.** FORKCAST does not call a candidate successful because its own search loop said so.
- **Commitment is a separate act.** A plan cannot be committed by the tool that generated it. A read-only preview issues a single-use approval token, and the commit requires an explicit phrase.
- **The system can report a pass.** The dishwasher branch passes with a warning and no repair. The application does not manufacture a failure to look impressive.
- **No LLM is in the calculation path.** The demo runs without any API key.
- **The browser is a real MCP client.** The interaction is not a REST API renamed as "MCP".

## How it works, technically

1. A deterministic `WorldState` seed defines inventory, delivery availability, resources, tasks, meals and the 6:00 PM deadline.
2. The plan builder combines common tasks with a selected meal.
3. The scheduler validates the graph, detects cycles, reserves ingredients, resolves resource alternatives, and uses a deterministic earliest-start greedy list schedule.
4. The scheduler returns task intervals, resource intervals, evidence, violations, completion and slack.
5. FAULTLINE clones the world for the baseline and each fault. One mutation is applied per clone.
6. The compare layer computes new errors, warnings, affected tasks and deadline status.
7. The repair search evaluates defined meal/order candidates within a 24-candidate bound. The chosen candidate is re-scheduled independently.
8. The approval service re-schedules again, builds exact local diffs, issues a five-minute token, and writes atomically only after explicit approval.
9. The MCP server exposes these functions as 9 real tools over Streamable HTTP, MCP 2025-11-25.
10. React renders the returned data. The browser uses the official TypeScript SDK for initialization, tool discovery and calls.

## Demonstrated functionality

- Baseline schedule: feasible at 5:35 PM, 25 minutes of slack.
- Delivery delay: infeasible at 6:05 PM, one new hard constraint.
- Chicken unavailable: missing-ingredient constraint; roast path unschedulable.
- Roast overrun: 105 minutes; infeasible at 6:10 PM.
- Dishwasher offline: feasible with an optional omission; no repair generated.
- Repair: paneer curry verified at 5:32 PM for the three failures.
- Commit: local revision changes from 1 to 2; inventory is decremented; execution and audit records are written.
- Repeat commit: rejected.
- Restart: revision 2 and applied execution persist.
- Reset: seed content is restored; stale previews are invalidated; audit history remains.
- UI: responsive at 1600 px desktop, 820 px tablet and 390 px mobile.

## Target user

- A developer evaluating agentic scheduling or workflow tools.
- A hackathon judge who wants to see a real calculation rather than a story.
- A product team exploring approval gates for local automation.
- A developer who needs an open-source pattern for isolated fault testing.

The current implementation is a demonstration, not a general consumer product.

## Potential impact

The same pattern applies beyond dinner:

- delivery and logistics planning;
- maintenance windows;
- care schedules;
- event preparation;
- agent workflow testing;
- any plan with dependencies, finite resources and hard deadlines.

FAULTLINE is the reusable part. FORKCAST is a concrete, inspectable application of it.

## Limitations

- The household and request mapping are fixed for the demo.
- The scheduler is a small greedy solver, not an optimizer.
- The repair space is deliberately bounded to defined meals and task orders.
- Single-user local server with no authentication.
- No hosted deployment.
- No real calendar, purchase, messaging or device integration.
- The full Official Rules page could not be verified due Cloudflare; manual submission checks are required.

## Honest claim boundary

FORKCAST is **not** an Alexa+ integration, an Amazon product, a production planner or a real-world purchasing agent. It is a working simulated experience and a real MCP server/client pair built for the hackathon's permitted simulated-experience path.

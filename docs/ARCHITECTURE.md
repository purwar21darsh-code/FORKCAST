# FORKCAST architecture

## Design goal

FORKCAST separates five things that are usually mixed together in AI planning demos:

1. **World state** — the simulated household.
2. **Schedule calculation** — deterministic arithmetic.
3. **Counterfactual isolation** — one fault per cloned world.
4. **Repair verification** — a second scheduler pass before calling a repair successful.
5. **Commit** — an explicitly approved write to local demonstration data.

The UI never invents a result. Every time, violation, task status and comparison shown is derived from a server response computed by the scheduler.

```
FORKCAST-HACKATHON/
  faultline/                      public open-source library (GitHub)
  forkcast/                       application
    src/
      domain/                     types, seed world, plan construction
      engine/                     scheduler, scenarios, comparison, repair, commit
      server/                     MCP service, HTTP transport, store
      shared/contracts.ts         tool payload types shared with the UI
    web/src/                      React browser MCP client
    tests/                        Vitest unit, integration and protocol tests
    scripts/e2e.mjs               Playwright acceptance test
    data/                         local demo persistence (gitignored)
    docs/                         architecture and competition material
```

## Runtime topology

```
┌──────────────────────────────────────────────────────────────┐
│ Browser :5173                                                │
│ React workstation                                            │
│   ForkcastMcpClient (official @modelcontextprotocol/sdk)      │
│   StreamableHTTPClientTransport -> POST/GET /mcp             │
└──────────────────────────────┬───────────────────────────────┘
                               │ CORS: localhost:5173 only
                               ▼
┌──────────────────────────────────────────────────────────────┐
│ Node MCP server :4179                                        │
│                                                              │
│  node:http  ── origin/body/session validation ──► transport  │
│                                                              │
│  McpServer per session                                       │
│    9 registered tools                                        │
│         │                                                    │
│         ▼                                                    │
│  ForkcastService                                             │
│    proposals | analyses | approval tokens (memory)           │
│         │                                                    │
│    ┌────┴───────────────┬───────────────────┐                │
│    ▼                    ▼                   ▼                │
│  Scheduler          FAULTLINE          DemoStore             │
│  deterministic      scenario matrix    atomic JSON           │
│    │                    │                   │                │
│    └───── repair/commit/verify ─────────────┘                │
└──────────────────────────────────────────────────────────────┘
```

The MCP endpoint is `http://127.0.0.1:4179/mcp`. The server does not expose simulation REST endpoints. The UI cannot bypass MCP for planning, simulation, repair or commit.

## World model

`WorldState` is defined in `src/domain/types.ts`.

- **Time:** integer minutes after midnight. All intervals are half-open `[start, end)`.
- **Seed:** a fixed Saturday 14 November 2026 label is display metadata only. The engine never reads the machine clock for scheduling.
- **Inventory:** ingredient quantity, unit, availability minute, delivery association and category.
- **Deliveries:** named batches with available time and member ingredients.
- **Resources:** capacity and availability. The demo uses capacity 1.
- **Tasks:** stable id, duration, dependencies, resources, optional resource alternatives, ingredient requirements, optional flag and phase.
- **Meals:** two defined recipes, each with a terminal check task.
- **Overrides:** scenario-local task duration overlays.
- **Execution:** the last approved local write.

The schedule has 13 tasks in the baseline. The critical chain is:

```
inventory_check -> primary_marinate -> primary_roast -> primary_rest
  -> primary_carve -> primary_plate -> primary_final_check
```

The final check also depends on rice, vegetables and table setting. The chilled chicken is available at 3:30 PM.

### Seed invariants

- Six guests, 6:00 PM guest deadline.
- 9:00 AM planning start.
- 13 baseline tasks.
- 7 resources.
- 8 inventory lines.
- 2 meal options.
- 4 fault scenarios.

The seed world is created fresh by `createSeedWorld()`; mutable instances are always cloned.

## Scheduler

File: `src/engine/schedule.ts`.

### Validation

Before scheduling, the engine checks:

- non-empty plan and legal task IDs;
- duplicate task IDs;
- positive integer durations and overrides;
- every dependency reference;
- dependency cycles using three-color DFS.

A structural error returns an infeasible schedule immediately with diagnostic violations.

### Ingredient handling

Ingredients are reserved deterministically before scheduling. Mandatory tasks reserve before optional tasks.

- Missing references produce `MISSING_INGREDIENT`.
- Aggregate over-allocation produces `INSUFFICIENT_INGREDIENT`.
- Mandatory blocked tasks are unschedulable.
- Optional blocked tasks are skipped with a warning.
- Availability minutes become start-time lower bounds.

This is a demonstration allocator, not a warehouse replenishment model.

### Resource handling

A task can declare fallback resources:

```ts
resources: ["oven"],
resourceAlternatives: { oven: ["countertop_oven"] }
```

The scheduler chooses the first available resource in that list. It does not switch to an alternative merely because the primary is busy; it waits for capacity. That limitation is documented rather than hidden.

For each ready task, `findEarliestSlot` tests candidate starts at the earliest dependency/ingredient time and at resource interval boundaries. It checks capacity for every required resource.

### Ordering

Among all currently ready tasks, the scheduler chooses the candidate with:

1. earliest feasible start;
2. plan order;
3. task id.

Ties are deterministic. There is no randomness.

### Constraints

Hard constraints:

- every mandatory task scheduled;
- every dependency respected;
- every required resource available and not over capacity;
- every required ingredient present and sufficient;
- projected completion at or before the guest deadline.

Optional omissions are warnings, not silent passes. A plan is feasible only when all mandatory tasks are scheduled, completion is known, completion is at or before the deadline and no error-severity violation exists.

### Evidence

The result includes:

- complete task list with null-safe start/end and status;
- resource interval timeline;
- all violations with codes and affected ids;
- projected completion and slack;
- resource wait count, ingredient wait count and candidate evaluations;
- the selected task order;
- algorithm and limitation notes.

The scheduler is pure: it does not mutate the input world or plan.

## Fault scenarios and FAULTLINE

Files: `src/engine/scenarios.ts`, `scenario-runner.ts`; the library is the published [`faultline-sim`](https://github.com/purwar21darsh-code/faultline) dependency.

Each scenario defines typed fault data, validation and a mutation that receives a private draft state.

| Scenario | Mutation |
| --- | --- |
| `delivery-delay` | Shift the chilled delivery and its ingredients by 30 minutes. |
| `chicken-unavailable` | Delete chicken from inventory and delivery membership. |
| `roast-overrun` | Set `taskDurationOverrides.primary_roast` to ceil(70 × 1.5) = 105. |
| `dishwasher-offline` | Set `resources.dishwasher.available = false`. |

`FAULTLINE.runScenarioMatrix`:

1. clones the original world for the baseline;
2. clones the original world again for each scenario;
3. applies exactly one scenario mutation to that clone;
4. calls the scheduler on the clone;
5. evaluates feasibility;
6. returns baseline, scenario states, outcomes and errors.

The original world is never passed to a simulation callback. The demo service also takes a snapshot before and after simulation in tests to verify state preservation.

The comparison layer (`src/engine/compare.ts`) computes:

- baseline and faulted completion;
- completion delta and slack delta;
- newly violated errors and new warnings;
- resolved baseline constraints;
- affected task start/end/status changes;
- missing ingredients and unavailable resources;
- optional omissions;
- a verdict: failed, passed, or passed with degradation.

## Repair

File: `src/engine/repair.ts`.

If the faulted schedule is already feasible, the result is **not-needed**. No repair is invented.

Otherwise the bounded search evaluates:

- every defined meal (2);
- every task-order profile (4): balanced, meal-first, setup-first, clean-first.

The limit is 24 candidates. The demo evaluates 8. Search is synchronous and cannot hang indefinitely.

A candidate is scored only for selection after it passes hard constraints. The score combines completion minute, changed tasks, meal substitution, resource reassignment and optional omissions. The earliest feasible candidate is preferred.

The selected candidate is **re-scheduled independently** by calling `schedulePlan` again. The result is only marked feasible if the second pass reproduces feasibility, completion and every task start/end. Otherwise FORKCAST returns `simulation-error` and refuses to claim a repair.

The repair diff reports:

- meal substitution;
- tasks added and removed;
- reordered common tasks;
- resource assignment changes;
- ingredient ids added and removed;
- optional omissions;
- original/faulted completion, repaired completion and delta;
- trade-offs and "constraints relaxed: none".

## Approval and commit

Files: `src/engine/commit-preview.ts`, `src/server/service.ts`.

A plan cannot be committed from the tool call that generated it.

1. `forkcast.preview_commit` re-schedules the proposal against the current world.
2. It rejects stale revisions, infeasible plans and an already-applied demo.
3. It builds exact inventory before/use/after changes and an execution record.
4. It returns a single-use random token expiring after five minutes.
5. No world data is written.
6. `forkcast.commit_approved_plan` requires that token and the exact phrase `APPROVE LOCAL DEMO COMMIT`.
7. The service marks the token used before its first await, checks the revision and writes atomically.
8. The world revision increments and `appliedExecution` records the actual local change.
9. A repeat commit is rejected and audited as `COMMIT_REJECTED`.

Reset restores the seed content but advances the revision so an in-flight preview cannot be applied afterward. It clears proposals, analyses and tokens and preserves audit history.

## Persistence

File: `src/server/store.ts`.

Default data directory: `forkcast/data/`.

- `demo-state.json` — world snapshot.
- `activity.json` — capped audit history.
- writes go to a unique temp file and are renamed into place;
- a per-file promise queue serializes writes;
- expected-revision writes reject stale commits;
- malformed files are renamed to a timestamped `.corrupt-` backup before seed recovery;
- if a malformed file cannot be preserved, startup fails rather than overwriting it;
- reset never deletes project files or unrelated files.

Plans, analyses and approval tokens are intentionally in memory only. A restart preserves the committed demo state and audit history, but not proposal IDs.

## MCP server

Files: `src/server/http.ts`, `mcp.ts`, `service.ts`.

- Official SDK: `@modelcontextprotocol/sdk` 1.32.1.
- Protocol: MCP **2025-11-25**.
- Transport: Streamable HTTP.
- Stateful sessions with `Mcp-Session-Id`, random UUID session ids and a 64-session cap.
- Session cleanup on DELETE/close.
- CORS default allowlist: `http://127.0.0.1:5173` and `http://localhost:5173`; extra origins via `FORKCAST_ALLOWED_ORIGINS`.
- POST requires `application/json`, max body 1 MB.
- Explicit HTTP errors for malformed JSON (400), wrong content type (415), unknown session (404), disallowed origin (403) and session overload (503).
- Each tool returns both JSON text content and `structuredContent`.
- Domain errors return `isError: true` with a structured `{ error: { code, message, details? } }` payload.
- Tool annotations distinguish read-only inspection, computed proposals, demo writes and destructive local demo operations.

The MCP server is not advertised as a production service. It binds to loopback and has no authentication.

## Browser MCP client

File: `web/src/mcp/client.ts`.

`ForkcastMcpClient` uses the official SDK's `Client` and `StreamableHTTPClientTransport`.

- `connect()` performs MCP initialization and `tools/list`.
- The UI displays the real returned tool names, descriptions and annotation tags.
- Every planning/simulation/repair/preview/commit/reset action calls `tools/call`.
- Tool errors are surfaced with their structured code and message.
- SSE keeps the connection open, so the app deliberately does not wait for browser `networkidle`.
- The connection indicator and retry action are real.

No server secret is present in browser code. The only build-time variable is the public MCP URL.

## UI composition

Files under `web/src/`.

- **Timeline** — SVG from actual `startMinute`/`endMinute`; task names, resources, dependencies and status. Mobile falls back to a vertical task list.
- **Dependency graph** — actual edges and topological columns; mobile falls back to a prerequisite list.
- **Scenario deck** — four real tools calls; statuses reflect returned analyses.
- **Comparison** — calculated times, deadline result, new constraints, warnings, missing ingredients, resources and affected tasks.
- **Repair workspace** — verified status, changes, trade-offs and independent verification facts.
- **Execution review** — exact inventory changes, revision change, explicit checkbox and approval phrase.
- **Audit log** — persisted server events only, newest first.
- **Tool inspector** — actual discovery output and negotiated protocol.
- **Accessibility** — semantic buttons, visible focus, ARIA labels, status text in addition to color, reduced-motion CSS, skip-free linear headings, mobile layouts with no page-level horizontal overflow.

## Failure modes and handling

| Failure | Behaviour |
| --- | --- |
| MCP server offline | Connection banner, retry action, no fake data. |
| Invalid tool args | SDK validation / tool error shown. |
| Unknown plan or analysis | Structured MCP error. |
| Stale revision | Preview/commit rejected with `STALE_PLAN`. |
| Expired approval | Rejected with `APPROVAL_EXPIRED`. |
| Reused token | Rejected with `ALREADY_COMMITTED`. |
| Infeasible commit | Rejected with `PLAN_NOT_FEASIBLE`. |
| Simulation exception | Scenario status error in FAULTLINE; no success. |
| Scheduler detects cycle | Infeasible schedule with `DEPENDENCY_CYCLE`. |
| Corrupt demo JSON | Preserve backup, restore seed, audit recovery. |
| Audit write failure after commit | Explicit `PERSISTENCE_ERROR` stating the data write succeeded and telling the user not to re-submit. |
| Browser disconnect | Session dies; reconnect creates a new session. Proposals are memory-only. |

## Known technical debt

- No authentication or multi-user isolation.
- Single scheduler plan at a time; proposals are in-memory.
- No async scheduling or worker isolation.
- Greedy scheduler is not optimal.
- No general natural-language parsing.
- No hosted demo.
- Bundle size warning from the MCP SDK dependency.
- Published repositories: [FORKCAST](https://github.com/purwar21darsh-code/FORKCAST) and [FAULTLINE](https://github.com/purwar21darsh-code/faultline).

## Verification evidence

- `npm test` — 39 passing tests across scheduler, scenarios, repair, store, commit and real MCP protocol.
- `npm run typecheck` — server and web pass.
- `npm run build` — TypeScript server and Vite web build pass.
- `npm run e2e` — Playwright acceptance covers browser MCP initialization, baseline, fault, repair, cancel, commit, restart persistence, reset and 390/820 responsive layouts.
- FAULTLINE: 13 passing unit tests, typecheck, package build and runnable example.
- `npm audit`: 0 vulnerabilities in both repositories at final verification.
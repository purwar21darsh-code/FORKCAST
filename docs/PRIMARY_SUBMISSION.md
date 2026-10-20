# Primary submission draft — FORKCAST

> **Published repository, not yet submitted.** The code repository is public; the demo video URL is still unset. Do not claim submission until Devpost confirms it.

## Project name

**FORKCAST — The AI That Stress-Tests Tomorrow**

Tagline: **Don't just make a plan. Break it before reality does.**

## Track and mini challenge

- **Primary track:** Alexa+
- **Mini challenge:** Open Source (FAULTLINE)
- **Not entering:** Fire TV, Bee, Ring, AWS Builder

## Concise summary

FORKCAST is a deterministic counterfactual planning workstation for a simulated household. It builds a real schedule for six dinner guests, injects controlled failures into isolated copies of the world, calculates which constraints break, searches defined alternatives for a repair, independently verifies the repaired schedule, and requires explicit approval before writing the approved plan to local demonstration data.

The browser is a real MCP client. The Node server is a real self-hosted MCP server using the official TypeScript SDK, MCP 2025-11-25 and Streamable HTTP.

## Target user

Developers and product teams testing agentic scheduling workflows, and hackathon judges who need to see a real calculation and a real MCP integration rather than a generated narrative.

## Problem

A plan can look correct and still fail when reality changes. Most assistant demos show only the happy path, do not calculate constraint violations, cannot isolate faults, and have no meaningful approval boundary between "suggested" and "applied".

## Proposed solution

1. Model a small world with time, dependencies, inventory, delivery availability, resources and a hard deadline.
2. Calculate a dependency- and resource-aware schedule.
3. Clone the world for each fault and inject one controlled failure.
4. Recalculate and report exact constraint violations.
5. Search only defined meal/task-order alternatives for a repair.
6. Re-schedule the repair independently before calling it verified.
7. Show the exact local changes and require an explicit approval phrase.
8. Write only to the local demo dataset and persist an audit trail.

## How the Alexa+ track requirements are satisfied

- **Self-hosted MCP server:** implemented on port 4179 at `/mcp`.
- **MCP specification:** 2025-11-25, negotiated and asserted in the protocol tests.
- **Transport:** Streamable HTTP.
- **Actual MCP usage:** the React browser initializes the MCP session, lists tools, and calls every workflow tool through the official SDK.
- **Simulated Alexa+ experience:** explicitly permitted by the official FAQ. The app is a browser workstation, not an Alexa+ integration.
- **No gated Alexa+ tooling:** the Category SDK, MCP Toolkit, CLI and Web Simulator are select-partner preview tools and were not used or claimed.
- **No physical device required.**
- **Source and setup:** both repositories are public and MIT-licensed: [FORKCAST](https://github.com/purwar21darsh-code/FORKCAST), [FAULTLINE](https://github.com/purwar21darsh-code/faultline). FORKCAST pins FAULTLINE to a published commit.

## Technical architecture

```
React + Vite (5173)
  official MCP SDK Client
  StreamableHTTPClientTransport
        │
        ▼
Node MCP server (4179) /mcp
  McpServer + StreamableHTTPServerTransport
  ForkcastService
    ├─ deterministic scheduler
    ├─ FAULTLINE scenario matrix
    ├─ bounded repair + verification
    ├─ approval tokens and commit
    └─ atomic demo store
```

### Actual technologies

- Node.js 24.22.0
- TypeScript 5.9.3, strict
- React 19.3.1
- Vite 7.3.7
- `@modelcontextprotocol/sdk` 1.32.1
- Zod 3.25.76
- Vitest 5.0.5
- Playwright 1.64.1 + Chrome
- FAULTLINE 0.1.0 ([published v0.1.0](https://github.com/purwar21darsh-code/faultline/releases/tag/v0.1.0), pinned Git dependency)
- MIT license

### Key modules

- `src/domain/` — world, seed, plan, time, errors.
- `src/engine/schedule.ts` — deterministic scheduler.
- `src/engine/scenarios.ts` — typed fault definitions.
- `src/engine/scenario-runner.ts` — FAULTLINE integration.
- `src/engine/compare.ts` — counterfactual comparison.
- `src/engine/repair.ts` — bounded repair and independent verification.
- `src/engine/commit-preview.ts` — exact local diff and commit application.
- `src/server/` — MCP, HTTP, store, service.
- `web/src/` — browser MCP client and UI.
- `faultline-sim` — published generic open-source scenario matrix.

## Innovation and differentiation

- A calculated schedule with explicit evidence, not generated times.
- Real state isolation through a separate open-source library.
- A repair that must survive an independent second scheduler pass.
- A real "pass with degradation" outcome (dishwasher unavailable) rather than forcing every fault to fail.
- Explicit approval token + phrase; no commit from generation.
- Stale, repeated and infeasible commits rejected.
- The browser is an actual MCP client; initialization and tool discovery are visible.
- The core requires no LLM or API key.

## Demonstration highlights

- Baseline: **5:35 PM**, **25 minutes of slack**.
- Delivery delay: **6:05 PM**, deadline missed.
- Chicken unavailable: missing-ingredient failure.
- Roast overrun: 105 minutes, **6:10 PM**.
- Dishwasher offline: feasible, optional task skipped, no repair invented.
- Verified repair: paneer curry, **5:32 PM**, **28 minutes of slack**.
- Commit: revision 1 → 2, inventory consumed, execution and audit persisted.
- Cancel: no write.
- Repeat commit: rejected.
- Restart: committed state survives.
- Reset: seed restored, revision advanced, stale previews invalidated.
- Responsive: desktop, tablet, mobile.
- E2E: Playwright covers all of the above.

## Actual test evidence

```text
FORKCAST: 39 Vitest tests passing
  scheduler: 13
  scenario/repair: 11
  commit/approval: 6
  store: 5
  real MCP protocol: 4
Typecheck: pass (server + web)
Build: pass (server + Vite)
Playwright E2E: pass
FAULTLINE: 13 Vitest tests passing, typecheck and build pass
```

The E2E was run against the production build, with a temporary data directory, real Chrome, real MCP server on 4179 and Vite preview on 5173. A clean clone from the public GitHub repository was also installed, tested and built using the published FAULTLINE Git dependency.

## Repository URL

**<https://github.com/purwar21darsh-code/FORKCAST>**

## Demo URL

**[REQUIRED MANUAL ACTION — no video has been recorded.]**

The video must be public, English, on YouTube or Vimeo, and under 3 minutes. See [DEMO_SCRIPT.md](DEMO_SCRIPT.md).

## GitHub username

**`purwar21darsh-code`**

## Limitations and future work

- Fixed demonstration request/world; not a general natural-language planner.
- Greedy scheduler, not an optimizer.
- Bounded repair space.
- Local single-user server, no authentication.
- No hosted deployment.
- No real device, purchase, booking or messaging integration.
- Bundle-size warning from the MCP SDK.
- FAULTLINE dependency is local until publication.

## Accurate relationship statement

FORKCAST is an independent hackathon project. It is **not** built by, affiliated with, endorsed by, or integrated into Amazon or Alexa+. It is a simulated experience using the self-hosted MCP path that the official FAQ permits. No gated Alexa+ developer tooling was accessed.

## Submission status

**Not submitted.** The verified close is **23 October 2026, 12:00 PM PDT** (24 October 2026, 12:30 AM IST), per an archived official-rules capture; re-check the live submission UI. Manual fields above are required.
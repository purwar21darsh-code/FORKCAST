# FORKCAST

**The AI that stress-tests tomorrow.**  
*Don't just make a plan. Break it before reality does.*

FORKCAST is a local, deterministic counterfactual planning workstation for a simulated six-guest dinner. It builds a real task schedule, injects four controlled faults into isolated copies of the household world, calculates which constraints break, searches defined alternatives for a repair, verifies the repaired schedule with an independent scheduler pass, and requires explicit approval before writing anything to the local demo dataset.

It is not a chatbot and does not ask an LLM to invent times or decide whether a plan is feasible. The browser is a genuine MCP client; the Node backend is a genuine MCP server.

> **Status:** version 0.1.0, public repository: <https://github.com/purwar21darsh-code/FORKCAST>. Local demonstration, not deployed, not affiliated with Amazon. FAULTLINE is published at <https://github.com/purwar21darsh-code/faultline>.

---

## What is real, and what is simulated

| Layer | Status |
| --- | --- |
| Household world | A fixed, local demonstration dataset. No live calendar or real household connection. |
| Schedule | Calculated by a deterministic dependency/resource scheduler. |
| Fault injection | Real state cloning and mutation through the FAULTLINE library. |
| Constraint result | Calculated from the resulting schedule, not hardcoded. |
| Repair | Searched over defined meals and task orders; accepted only after a second scheduler verification. |
| Commit | Writes inventory and execution state to `data/demo-state.json` only. |
| Purchases, messages, bookings, devices | **Never performed.** |
| LLM | Not used. The core works without any API key. |

The natural-language request is routed to the fixed six-guest demo seed. FORKCAST exposes that interpretation in every draft response. No language model is generating the plan.

---

## The seeded demonstration

- **Household:** six guests, arrival deadline 6:00 PM.
- **Baseline meal:** herb roast chicken with rice and seasonal vegetables.
- **Chilled delivery:** chicken and butter available at 3:30 PM.
- **Baseline result:** finishes **5:35 PM**, with **25 minutes of slack**.
- **Alternate meal:** paneer tomato curry, with a 4:30 PM service window start and pantry ingredients.

The four scenario branches are:

1. **Delivery delayed 30 minutes** — chilled ingredients arrive at 4:00 PM. Baseline finish slips to 6:05 PM and the guest deadline is missed.
2. **Chicken unavailable** — the chicken is removed from the isolated inventory copy. The roast path is unschedulable.
3. **Roast overruns 50%** — 70 minutes becomes ceil(70 × 1.5) = 105 minutes. The plan finishes at 6:10 PM.
4. **Dishwasher unavailable** — only the optional pre-rinse task is skipped. Mandatory dinner constraints still pass. This branch demonstrates a non-failure and a real "no repair needed" result.

For the three failures, the repair search selects the defined paneer curry and verifies completion at **5:32 PM**. The repair never relaxes the arrival deadline or invents a new meal.

---

## Architecture

```
Browser (React + Vite, port 5173)
  └─ official MCP TypeScript SDK
     └─ Streamable HTTP client
        └─ http://127.0.0.1:4179/mcp
           └─ MCP server (McpServer + StreamableHTTPServerTransport)
              ├─ world model + seed
              ├─ deterministic scheduler
              ├─ FAULTLINE scenario matrix (published Git dependency)
              ├─ bounded repair + independent verification
              ├─ approval tokens + commit service
              └─ atomic local demo persistence
```

FORKCAST depends on **[FAULTLINE](https://github.com/purwar21darsh-code/faultline)**, a separate MIT-licensed repository, through a pinned GitHub dependency: `"faultline-sim": "github:purwar21darsh-code/faultline#ca6f6ae..."`. FAULTLINE is the generic isolated-scenario engine; FORKCAST adds the household model, scheduler, comparisons, repair search, MCP tools and UI.

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Requirements

- Node.js 20.19 or newer (Vite 7 requirement). Tested with Node.js **24.22.0**.
- npm 11. Tested with **11.19.1**.
- Windows, macOS or Linux for the app.
- Playwright E2E uses an installed Chrome/Chromium; tested with Google Chrome on Windows.

If PowerShell blocks `npm.ps1` with an execution-policy error, use `npm.cmd` in every command below. This was observed on the build machine.

---

## Installation

FORKCAST installs its published FAULTLINE dependency from GitHub, pinned to a commit. A sibling clone is not required for normal installation.

```bash
git clone https://github.com/purwar21darsh-code/FORKCAST.git
cd FORKCAST
npm ci
npm test
npm run build
```

FAULTLINE can be developed or tested separately:

```bash
git clone https://github.com/purwar21darsh-code/faultline.git
cd faultline
npm ci
npm test
npm run build
npm run example
```

On Windows PowerShell where `npm.ps1` is blocked, use `npm.cmd`.

The dependency is pinned to the published FAULTLINE commit and package lockfile. To work on both projects simultaneously from source, replace the dependency with the local sibling path for that development session, then restore the pinned dependency before committing.

### Environment

Copy `.env.example` if you want to change defaults:

```bash
PORT=4179
MCP_HOST=127.0.0.1
FORKCAST_DATA_DIR=./data
VITE_MCP_URL=http://127.0.0.1:4179/mcp
```

Vite reads `VITE_MCP_URL` at build time. The browser has no server secrets.

---

## Run

Development:

```bash
npm run dev
```

This starts:

- Frontend: <http://127.0.0.1:5173>
- MCP server: <http://127.0.0.1:4179/mcp>
- Health check: <http://127.0.0.1:4179/health>

Production build:

```bash
npm run build
npm start            # MCP server on 4179
npm run start:web    # static preview on 5173
```

The backend binds to `127.0.0.1` by default. Do not expose it publicly: it has no authentication.

---

## Using the workstation

1. Wait for the header to show **MCP live** and **9 MCP tools discovered**.
2. Click **Run sample request**. This sends `forkcast.draft_plan` through MCP.
3. Inspect the baseline timeline, dependency graph, constraint ledger and calculation evidence.
4. Simulate a branch. Each click calls `forkcast.simulate_scenario`; the server uses FAULTLINE on a fresh world clone.
5. Compare calculated baseline/faulted times, newly violated constraints and affected tasks.
6. For a failed branch, click **Find and verify a repair**. The result is accepted only after a fresh independent re-schedule.
7. Click **Review exact local changes**. This calls `forkcast.preview_commit` and issues a single-use five-minute approval token. No demo data changes yet.
8. Optionally click **Cancel — no write** and verify the revision stays unchanged.
9. Check the explicit approval box and click **Approve and apply**. This sends the token plus the exact phrase `APPROVE LOCAL DEMO COMMIT`.
10. Reset the dedicated demo dataset with **Reset demo data**. The reset advances the revision to invalidate stale previews and preserves audit history.

---

## MCP tools

The MCP endpoint is real Streamable HTTP, MCP spec **2025-11-25**. The browser performs initialization and `tools/list`; it does not call hidden REST simulation endpoints.

| Tool | Purpose | Mutation |
| --- | --- | --- |
| `forkcast.inspect_world` | World, revision, applied execution, audit history | Read-only |
| `forkcast.draft_plan` | Calculate baseline plan and schedule | In-memory proposal + audit |
| `forkcast.list_scenarios` | Four fault definitions | Read-only |
| `forkcast.simulate_scenario` | FAULTLINE simulation of one fault | Audit only; world untouched |
| `forkcast.compare_scenarios` | Run/compare the scenario matrix | Audit only; world untouched |
| `forkcast.repair_plan` | Bounded search + independent verification | In-memory proposal + audit |
| `forkcast.preview_commit` | Re-schedule, exact diff, approval token | In-memory token + audit |
| `forkcast.commit_approved_plan` | Write approved plan to local demo state | **Demo data only** |
| `forkcast.reset_demo` | Restore seed content, bump revision | **Demo data only** |

The server also exposes `GET /health` and `GET /` for operational checks. Those are not part of the MCP workflow.

---

## Testing

```bash
npm test             # 39 unit/integration/MCP tests
npm run typecheck
npm run build
npm run e2e          # full Playwright acceptance against build
```

The E2E script starts the real MCP server on 4179 and a Vite preview on 5173, uses a temporary data directory, and verifies:

- MCP initialization and 9-tool discovery in Chrome.
- Baseline 5:35 PM.
- Delivery-delay failure at 6:05 PM with the demo world unchanged.
- Verified repair at 5:32 PM.
- Cancel writes nothing.
- Explicit approval commits revision 2.
- Backend restart preserves revision 2 and the applied execution.
- Reset restores seed content and advances the revision.
- 390 px mobile and 820 px tablet layouts have no horizontal page overflow.

Artifacts are written to `artifacts/`. The E2E needs Chrome. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to a browser executable if Chrome is not on the standard channel.

---

## Security and safety

- No credentials or API keys are used.
- Server binds to loopback by default.
- CORS allows only local frontend origins (5173) by default; additional origins must be explicitly configured.
- MCP POST requests must be `application/json`; bodies are limited to 1 MB; sessions are capped.
- Commit requires a per-plan, single-use approval token plus the exact approval phrase.
- Stale revisions, expired tokens, reused tokens, infeasible plans and repeat commits are rejected.
- Demo writes are atomic; malformed files are preserved before recovery.
- `npm audit` reported 0 vulnerabilities in both repositories, including development dependencies, at final verification.
- Reset affects only the dedicated demo data directory.
- FAULTLINE is a state-isolation coordinator, not a security sandbox. Do not run untrusted generated code as a simulation callback.

---

## Known limitations

- The request-to-world mapping is a fixed demonstration route. It is not a general natural-language planner.
- The household model is small and hand-seeded.
- Scheduler is a greedy list scheduler; it is deterministic and bounded but not an optimal solver.
- Repair search considers defined meals and four task-order profiles. It does not invent ingredients, meals, resources or constraints.
- Single-user local demo. There is no authentication, multi-tenant isolation or hosted deployment.
- Plans/proposals live in server memory and do not survive a restart; committed demo state and audit events do.
- The browser bundle includes the official MCP SDK and is ~542 kB minified (161 kB gzip); no code splitting has been added yet.
- The live Official Rules page was blocked by Cloudflare during development. The deadline and rules were verified from an archived official-rules capture (1 October 2026). Re-check the live submission UI before entering. See [docs/COMPETITION_REQUIREMENTS.md](docs/COMPETITION_REQUIREMENTS.md).

---

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Competition requirements](docs/COMPETITION_REQUIREMENTS.md)
- [Product description](docs/PRODUCT_DESCRIPTION.md)
- [Three-minute demo script](docs/DEMO_SCRIPT.md)
- [Product feedback](docs/PRODUCT_FEEDBACK.md)
- [Friction log](docs/FRICTION_LOG.md)
- [Primary submission draft](docs/PRIMARY_SUBMISSION.md)
- [Open-source submission draft](docs/OPEN_SOURCE_SUBMISSION.md)
- [Changelog](CHANGELOG.md)

## License

MIT. See [LICENSE](LICENSE).
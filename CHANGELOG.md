# Changelog

All notable FORKCAST changes are documented here.

## [0.1.0] - 2026-10-20

### Added

- Deterministic six-guest household world with fixed seed, inventory, deliveries, resources and two defined meals.
- Dependency- and resource-aware greedy scheduler with deadline, ingredient, capacity, cycle and optional-task handling.
- Four real fault scenarios applied through FAULTLINE clones: delivery delay, unavailable chicken, 50% roast overrun and unavailable dishwasher.
- Counterfactual comparison with calculated finish, slack, newly violated constraints, warnings and affected tasks.
- Bounded repair search across defined meals and task-order profiles, with an independent verification re-schedule.
- Real MCP server (MCP 2025-11-25, Streamable HTTP) on port 4179 at `/mcp`.
- Genuine browser MCP client using the official TypeScript SDK, with initialization, tool discovery and tool calls.
- Responsive React workstation with SVG timeline, SVG dependency graph, scenario branches, comparison, repair evidence, approval review and persisted audit trail.
- Single-use five-minute commit preview tokens, explicit approval phrase, stale/repeat commit rejection and atomic local demo writes.
- Demo reset that restores seed content, advances revision and preserves audit history.
- 39 Vitest unit/integration/MCP tests and a Playwright acceptance test covering desktop, tablet, mobile, cancellation, commit, restart and reset.
- Documentation, competition requirement notes, demo script, product feedback, friction log and submission drafts.

### Security

- Local-only default binding and restricted CORS origins.
- 1 MB MCP request body limit, JSON content-type enforcement and a 64-session cap.
- No real purchase, booking, messaging or device action.

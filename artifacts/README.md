# Verification artifacts

These screenshots were produced by `npm run e2e` against the built FORKCAST server and web bundle. They are evidence of actual browser/MCP behavior, not mockups.

| File | State |
| --- | --- |
| `e2e-00-baseline.png` | Baseline calculated at 5:35 PM with 25 minutes of slack. |
| `e2e-01-connected.png` | Real browser MCP session, 9 tools discovered. |
| `e2e-02-repair.png` | Verified paneer repair at 5:32 PM after the delivery-delay failure. |
| `e2e-03-approval.png` | Explicit commit review with exact inventory changes. |
| `e2e-04-committed.png` | Local demo revision 2, applied execution and audit log. |
| `e2e-05-mobile.png` | 390 px responsive layout with mobile task and dependency lists. |
| `e2e-06-tablet.png` | 820 px responsive layout. |

The E2E assertion rejects unexpected browser console errors, page errors and failed network requests. Expected MCP SSE aborts during page reload/restart are filtered.

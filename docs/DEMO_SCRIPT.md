# Three-minute demo script

**Target length: 2:55–3:00. Hard maximum from the current hackathon page: under 3 minutes.**

The demo must show the app running with real MCP calls. Do not splice in pre-recorded fake tool results.

## Before recording

1. Close other apps using ports 4179 or 5173.
2. Install and build FORKCAST. FAULTLINE is fetched from its pinned public Git dependency, so a sibling checkout is not required:

```powershell
cd E:\AI\FORKCAST\forkcast
npm.cmd ci
npm.cmd test
npm.cmd build
```

3. Start the production server and frontend preview in separate terminals:

```powershell
# Terminal 1
cd E:\AI\FORKCAST\forkcast
npm.cmd start

# Terminal 2
cd E:\AI\FORKCAST\forkcast
npm.cmd run start:web
```

4. Open <http://127.0.0.1:5173>.
5. Confirm the header shows **MCP live** and **9 MCP tools discovered**.
6. Open **Reset demo data → Confirm reset** once to start from the seed. The revision increases; that is expected and invalidates old previews.
7. Confirm **World revision** shows the new revision and **unmodified demonstration data**.
8. Set browser zoom around 90% at 1600×1000 so the timeline and comparison fit.
9. Close unrelated notifications.
10. Optional: use the E2E test immediately before recording to verify the machine.

```powershell
npm.cmd run e2e
```

## Exact recording flow

### 0:00–0:20 — The problem

**Screen:** FORKCAST hero and request panel.

**Narration:**

> Plans do not fail on the happy path. They fail when a delivery is late, an ingredient disappears, a task overruns, or a resource goes offline. FORKCAST is an engineering workstation that breaks a plan before reality does. It calculates a real schedule, stresses it, and only applies a repair after I explicitly approve it.

### 0:20–0:50 — Baseline

**Action:** Click **Run sample request**.

**Screen:** Timeline appears with baseline finish 5:35 PM and 25 minutes of slack.

**Narration:**

> The request is routed to a fixed six-guest demo world. No language model invented these times. The deterministic scheduler read the dependencies, the 3:30 PM chilled delivery, the kitchen resources and the 6 PM deadline. The roast chicken plan finishes at 5:35, with 25 minutes of slack. The graph below shows the actual prerequisites.

Point briefly at:

- **Finish 5:35 PM**
- **Slack 25 min**
- **Dependency graph**

### 0:50–1:25 — Fault one

**Action:** Click **Simulate branch** on **Chilled delivery delayed 30 minutes**.

**Screen:** Comparison shows baseline 5:35 PM, faulted 6:05 PM, −5 minutes slack, one new hard constraint, six affected tasks.

**Narration:**

> The MCP simulation tool cloned the world and delayed only the chilled delivery by 30 minutes. The scheduler recalculated. The plan now finishes at 6:05 and misses the guest deadline. The original world is unchanged. The comparison names the exact tasks that moved and the exact constraint that broke.

### 1:25–1:55 — Fault two and the matrix

**Action:** Click **Chicken unavailable → Simulate branch**. Do not wait for a long explanation.

**Screen:** Missing chicken, unschedulable roast tasks, failed verdict.

**Narration:**

> A missing chicken is not a paragraph of speculation. The isolated inventory no longer has the ingredient, the roast chain cannot be scheduled, and the comparison reports the missing ingredient. Each branch starts from a fresh clone, so this fault cannot contaminate the first one.

Optional if time permits: click **Run all four** and point at the dishwasher branch passing with only an optional omission.

### 1:55–2:25 — Verified repair

**Action:** Click **Find and verify a repair** on the chicken or delivery branch.

**Screen:** Repair workspace: paneer curry, 5:32 PM, 28 minutes slack, **verified**.

**Narration:**

> FORKCAST searches only the meals and task orders defined in the world model. It selects the paneer curry and re-schedules it. Then it re-schedules the selected repair a second time, independently, before it is allowed to say "verified". This finishes at 5:32, 28 minutes before the deadline. No hard constraint was relaxed.

### 2:25–2:45 — Approval and commit

**Action:** Click **Review exact local changes**. Point at the inventory before/use/after table and the revision change. Check the approval box. Click **Approve and apply**.

**Screen:** Applied card; revision 2; inventory decremented; audit event.

**Narration:**

> The preview is read-only. The server issues a single-use, five-minute approval token. I explicitly confirm the exact inventory changes. Only then is the approved plan written to the local demo data. No purchase, message, booking or device action occurs. A repeat commit is rejected.

### 2:45–3:00 — Open source and close

**Action:** Show the audit log, then cut to the FAULTLINE README or test output for two seconds.

**Narration:**

> Under the hood, FORKCAST depends on FAULTLINE, a reusable TypeScript library for isolated fault-scenario matrices, with its own tests, example and MIT license. The complete browser-to-MCP flow, cancellation, commit, restart and reset are covered by an automated end-to-end test. Don't just make a plan. Break it before reality does.

## Expected values (do not improvise)

| Item | Expected |
| --- | --- |
| Baseline completion | 5:35 PM |
| Baseline slack | 25 minutes |
| Delivery delay completion | 6:05 PM |
| Delivery delay hard breaks | 1 |
| Chicken unavailable | missing chicken, failed |
| Roast overrun | 6:10 PM, failed |
| Dishwasher offline | feasible, optional task skipped |
| Repair meal | Paneer tomato curry |
| Repair completion | 5:32 PM |
| Repair slack | 28 minutes |
| Repair verified | Yes, independent re-schedule |
| Demo revision after commit | previous revision + 1 |
| Repeat commit | rejected |

## Recovery

- **MCP offline:** start `npm.cmd start`; wait for MCP live.
- **Stale plan:** re-draft the baseline. A reset intentionally invalidates old proposals.
- **Expired approval:** click **Review exact local changes** again.
- **Wrong state:** **Reset demo data → Confirm reset**.
- **Port already in use:** stop the other process, not the demo.
- **Accidental commit:** reset; audit history remains, which is expected.

## Video compliance checklist

- [ ] Under 3:00.
- [ ] Public on YouTube or Vimeo.
- [ ] English audio (or English captions if narration is not clear).
- [ ] Shows real MCP initialization/tool discovery and real tool calls.
- [ ] Does not show fabricated results.
- [ ] No unlicensed music or third-party footage.
- [ ] No API keys, tokens, personal data or terminal history with secrets.
- [ ] Describes the project as a simulated experience, not an Amazon integration.
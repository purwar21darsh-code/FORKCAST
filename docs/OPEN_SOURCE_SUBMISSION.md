# Open Source mini-challenge draft — FAULTLINE

> **Published.** The repository and `v0.1.0` release are public. No pull request, stars, adoption or external usage is claimed.

## Project

**FAULTLINE** — a reusable TypeScript counterfactual simulation and fault-injection toolkit for testing proposed agent workflows in isolated state.

## Repository URL

**<https://github.com/purwar21darsh-code/faultline>**

## Contribution URL

**Not applicable as a pull request.** This is a **new project**, not a contribution to an existing repository. The mini-challenge rules allow a new additional open-source project.

Use the tagged release URL as the contribution URL for this new project:

**<https://github.com/purwar21darsh-code/faultline/releases/tag/v0.1.0>**

Confirm with the Devpost submission form whether it prefers the release URL or the repository URL for a new project.

## HomeFlow repository URL

**Not applicable.** No HomeFlow repository was provided, referenced in this workspace, or created by this build. Inventing one would be false. This submission is for FAULTLINE.

## GitHub username

**`purwar21darsh-code`**

## What was built

FAULTLINE provides:

- a typed `FaultScenario` API with fault type, payload, validation and an isolated mutation;
- a typed `runScenarioMatrix` baseline/scenario orchestrator;
- a clone-reference guard that rejects the common "clone returned the original object" bug;
- pass/fail/error/invalid statuses;
- captured simulation and evaluation exceptions;
- structured violations, metrics and summary counts;
- deterministic replay;
- an `isolation` disclosure that distinguishes state cloning from a security sandbox;
- a runnable kitchen task/inventory example;
- unit tests and API documentation;
- an MIT license and independent lockfile/package manifest;
- compatibility with Node.js 20.19+ and ESM.

## How it works

```ts
const report = runScenarioMatrix({
  initialState,
  plan,
  scenarios,
  cloneState: structuredClone,
  simulateInSandbox(state, plan, context) {
    // deterministic domain simulation
    return result;
  },
  evaluateOutcome(result, context) {
    return { passed, summary, violations, metrics };
  }
});
```

The baseline gets one clone. Every scenario gets a fresh clone of the original state. Only that clone is passed to the scenario's `applyFault`, then to the simulator. The original state is never handed to user callbacks. Scenario-level exceptions are returned as errors; a broken baseline rejects because no trustworthy comparison exists.

The library is explicitly **not** a VM, container or security sandbox. Simulation callbacks run in-process. This boundary is documented in the README and API reference.

## Why it matters to other developers

Agent and workflow developers often test only the happy path. FAULTLINE gives them a small, dependency-free pattern for:

- testing plans against late resources, missing inputs, overruns and outages;
- keeping faults isolated from each other;
- distinguishing a real failure from a simulation error;
- making counterfactual results reproducible;
- comparing agent plans before executing them;
- reusing the same infrastructure in scheduling, logistics, maintenance and automation tools.

FORKCAST consumes FAULTLINE as a real GitHub dependency through `package.json`, pinned to commit `ca6f6ae`, not as a copied demonstration.

## Reproducible example

```powershell
git clone https://github.com/purwar21darsh-code/faultline.git
cd faultline
npm.cmd ci
npm.cmd test
npm.cmd typecheck
npm.cmd build
npm.cmd run example
```

The example prints a baseline, missing ingredient, delivery delay and 50% task overrun, then verifies:

- the original state is unchanged;
- the scenarios do not affect each other;
- repeated runs serialize identically;
- all three faults are calculated rather than hardcoded.

## Test evidence

Last run:

```text
Test Files  1 passed (1)
Tests       13 passed (13)
Typecheck   pass
Build       pass
Example     pass
```

Covered: cloning, clone-reference rejection, baseline, scenario isolation, fault injection, deterministic replay, duplicate/malformed scenarios, simulation exceptions, evaluator exceptions, multiple scenarios, original-state preservation, summary status and invalid root input.

## License

MIT. The library has no runtime dependencies.

## Timing and eligibility

- Created during the current hackathon cycle (October 20, 2026).
- The Devpost listing gives a submission period of **August 31 – October 23, 2026**.
- The archived official rules confirm a close at **23 October 2026, 12:00 PM PDT** (24 October 2026, 12:30 AM IST) and a Submission Period from 31 August 2026. The live rules page was Cloudflare-blocked; the entrant must re-check the live submission UI before submitting.
- The entrant must confirm their own eligibility, age, team status and GitHub ownership.
- No claim of external adoption, stars, benchmarks, production readiness or third-party usage is made.

## Publication status

1. [x] Reviewed both repositories for secrets and personal data.
2. [x] Created public GitHub repository `purwar21darsh-code/faultline`.
3. [x] Kept the MIT `LICENSE`, README, package manifest, lockfile, tests and example.
4. [x] Committed with independent history.
5. [x] Created and pushed tag `v0.1.0`.
6. [x] Recorded the repository URL, release/contribution URL and GitHub username.
7. [x] Published FORKCAST separately and pinned its dependency:
   ```json
   "faultline-sim": "github:purwar21darsh-code/faultline#ca6f6ae670ca10617192834854e738012d923c1d"
   ```
8. [x] Confirmed that a clean clone can install, test and build.
9. [ ] Submit the Devpost entry and do not claim acceptance until Devpost confirms.

## Verification checklist

- [x] Repository public and MIT licensed.
- [x] GitHub username added.
- [x] Repository URL added.
- [x] Tag/release URL added.
- [x] Independent Git history confirmed.
- [x] `npm.cmd test` passes from a clean clone (verified 20 Oct 2026).
- [x] `npm.cmd run example` passes (verified 20 Oct 2026).
- [x] FORKCAST installs the published dependency (verified by clean clone).
- [x] No fabricated contribution/PR status.
- [ ] Devpost fields completed manually and entry submitted.
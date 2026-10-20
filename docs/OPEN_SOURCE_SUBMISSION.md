# Open Source mini-challenge draft — FAULTLINE

> **Draft only.** The repository is local. No URL, tag, release, pull request, stars or adoption are claimed.

## Project

**FAULTLINE** — a reusable TypeScript counterfactual simulation and fault-injection toolkit for testing proposed agent workflows in isolated state.

## Repository URL

**[REQUIRED MANUAL ACTION — publish the `faultline/` repository first. Do not invent a URL.]**

Suggested repository name: `faultline`.

## Contribution URL

**Not applicable as a pull request.** This is a **new project**, not a contribution to an existing repository. The mini-challenge rules allow a new additional open-source project.

After publication, enter one of:

- the repository URL, or
- a tagged release URL, for example `https://github.com/<user>/faultline/releases/tag/v0.1.0`.

Confirm with the Devpost submission form which URL it expects for a new project.

## HomeFlow repository URL

**Not applicable.** No HomeFlow repository was provided, referenced in this workspace, or created by this build. Inventing one would be false. This submission is for FAULTLINE.

## GitHub username

**[REQUIRED MANUAL ACTION — enter your own GitHub username.]**

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
- compatibility with Node.js 20+ and ESM.

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

FORKCAST consumes FAULTLINE as a real local dependency through `package.json`, not as a copied demonstration.

## Reproducible example

```powershell
cd faultline
npm.cmd install
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

## Manual publication steps

1. Review both repositories for secrets and personal data.
2. Create a new **public GitHub repository** named `faultline`.
3. Keep the MIT `LICENSE`, README, package manifest, lockfile, tests and example.
4. Commit with an independent history (do not nest inside another repository).
5. Create a version tag, for example `v0.1.0`.
6. Record the repository URL, tag/contribution URL and GitHub username in this file.
7. Publish FORKCAST separately and make its FAULTLINE dependency reproducible:
   ```json
   "faultline-sim": "github:<user>/faultline#v0.1.0"
   ```
   or keep the documented clone-both-siblings setup.
8. Confirm that a clean clone can install and run.
9. Do not claim the Open Source entry is submitted until Devpost accepts it.

## Verification checklist

- [ ] Repository public and MIT licensed.
- [ ] GitHub username added.
- [ ] Repository URL added.
- [ ] Tag/release URL added.
- [ ] Independent Git history confirmed.
- [x] `npm.cmd test` passes from a clean clone (verified 20 Oct 2026).
- [x] `npm.cmd run example` passes (verified 20 Oct 2026).
- [ ] FORKCAST installs the published dependency or documents sibling clone.
- [ ] No fabricated contribution/PR status.
- [ ] Devpost fields completed manually.
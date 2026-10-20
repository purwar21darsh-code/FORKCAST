# Competition requirements verification

**Verified:** 20 October 2026 (Asia/Calcutta), roughly four days before the listed submission close.

This document distinguishes what was actually read from official/primary sources from what remains unresolved. The full Official Rules page was blocked by Cloudflare during automated verification, so this is **not** a substitute for the entrant reading the rules before submitting.

## Sources

| Source | What it is | Access result |
| --- | --- | --- |
| <https://amazonappdev2026.devpost.com/> | Official hackathon home | Read through a text-rendering proxy; Cloudflare blocked a direct browser fetch. |
| <https://amazonappdev2026.devpost.com/details/faqs> | Official FAQ | Read through a text-rendering proxy. |
| <https://amazonappdev2026.devpost.com/rules> | Official Rules | **Blocked:** HTTP 403, "Just a moment" Cloudflare challenge, including a real Chrome attempt. Unresolved. |
| <https://devpost.com/api/hackathons?search=build%20ship%20shape> | Devpost public listing API | Returned listing with submission period **Aug 31 – Oct 23, 2026** and "4 days left" on 20 Oct 2026. |
| <https://github.com/modelcontextprotocol/typescript-sdk/tree/v1.x> | Official MCP TypeScript SDK v1 README | Read; v1.32.1 implements MCP **2025-11-25**. |
| <https://modelcontextprotocol.io/specification/2025-11-25> | MCP specification | Requirement target named by the hackathon page. |
| <https://github.com/modelcontextprotocol/typescript-sdk> | SDK main branch | v2 packages implement the later 2026-07-28 spec; this project intentionally uses v1.32.1 for the track's 2025-11-25 requirement. |

## Verified requirements

### Event and deadline

- Event: **Build, Ship, Shape: Amazon Developer Hackathon**.
- Submission period from the Devpost listing API: **August 31, 2026 – October 23, 2026**.
- On 20 October 2026 the listing displayed **"4 days left"**.
- **Deadline time and timezone were not verified.** The Official Rules page was inaccessible. Do not assume 23:59 in any particular zone. The entrant must verify the exact close time in the Devpost submission UI and Official Rules before submitting.
- FAQ says judging runs **November 9–20** (the year implied by the current cycle).
- Winners announced: no, at verification time.

### Entrant and team

- Open to individuals worldwide except residents of a country, state, province or territory where U.S. or local law prohibits participation or receiving a prize.
- FAQ explicitly names **Brazil, Quebec, Russia, Crimea, Cuba, Iran, North Korea**, plus other comprehensively OFAC-sanctioned countries.
- No maximum team size in the FAQ. A team designates a Representative to submit.
- This build does not assert or verify the user's age, residency, eligibility or team status. Those are manual checks.

### Alexa+ track

From the official home and FAQ:

- Build a **self-hosted MCP server** using MCP **spec 2025-11-25 or later** with **Streamable HTTP**, or an **Agent Skill**.
- A **simulated Alexa+ experience** is explicitly permitted.
- The gated Alexa+ developer tools (Category SDK, MCP Toolkit, CLI, Web Simulator) are **preview/select-partner only**; hackathon participants cannot apply for access. They are not required.
- A browser page acting as an **actual MCP client** — sending initialize, tools-list and tools-call over Streamable HTTP — satisfies the simulated-experience path.
- No physical Alexa device is required.
- For Alexa+, the repository must show the MCP server or Agent Skill actually being used. The source code must be included for a simulated experience.
- A locally runnable public repo plus demo video is enough for judging; hosting is not required.
- The MCP server does not have to stay running after submission.

**FORKCAST compliance:** it uses the official TypeScript SDK 1.32.1, negotiates MCP 2025-11-25 over Streamable HTTP at `/mcp`, and the browser is a real SDK client. The demo is explicitly a simulated household experience, not an Alexa+ integration.

### Submission artefacts

Verified from the official home/FAQ:

- A text description explaining what the project does and how it works.
- A **GitHub** code repository. GitLab or another host is explicitly not accepted.
- Repository must contain all source, assets and instructions to run.
- Repository must be public with an open-source license file, **or** private and shared with the listed Amazon reviewers and `testing@devpost.com`.
- Private sharing must be done through GitHub collaborator invitations; invitations expire after 7 days. Reviewer usernames listed: `knmeiss`, `giolaq`, `anishamalde`, `mosesroth`, `emersonsklar`.
- A **demo video under 3 minutes**, public, English, on YouTube or Vimeo. Judges are not required to watch past 3:00.
- Product feedback on every tool, API or SDK actually used: what it was used for, what worked, what needs work, onboarding, and whether the developer would use it again.
- Track(s) and mini challenge(s) being entered.
- If the project existed before the hackathon, a clear account of what changed during the submission window. FORKCAST and FAULTLINE are new projects created during this build.
- Optional feature requests and optional friction-log entries; friction logs can earn up to a **10% judging bonus** according to the home page.

### Open Source mini challenge

Verified from the official home:

- Ship a **new, additional open-source project** (with an open-source license) **or** a contribution (branch, fork or pull request) to a public repository **during the hackathon window**, alongside the primary-track submission.
- A PR does not need to be merged; an unmerged fork is acceptable.
- Include the **contribution URL**, **repository URL**, **GitHub username**, and a short description of what was done, how it works and why it matters.

**FORKCAST/FAULTLINE compliance:** FAULTLINE is a new, separate MIT-licensed library built during this cycle and consumed as a real dependency by FORKCAST. Repository and contribution URLs remain unset until the user publishes them. This document does not invent those URLs.

### Licensing

- An open-source license file is required for a public repository.
- MIT was selected for both projects. It is compatible with the included code and the MIT-licensed MCP TypeScript SDK.
- Third-party dependency licenses still need a final manual review before publication. The dependency set is small.

### Demo and accessibility

- Maximum **3 minutes**; public English video on YouTube or Vimeo.
- No third-party trademarks, copyrighted music or footage without permission.
- The demo must show the real project, not fake tool results.
- Accessibility was considered in the UI (keyboard focus, text status labels, reduced motion, responsive mobile/tablet layouts), but no official accessibility requirement beyond the video rules was verified.

### Product feedback and friction

- Product feedback is a required submission field for every tool/API/SDK used.
- Friction logs are optional but can earn up to 10%.
- Only real incidents are recorded in this repository. No bugs were manufactured.

## Compliance mapping for FORKCAST

| Requirement | How this build addresses it | Status |
| --- | --- | --- |
| Alexa+ track MCP path | Self-hosted MCP server, 2025-11-25, Streamable HTTP | Implemented and tested |
| Simulated experience permitted | Browser workstation + real MCP client | Implemented and tested |
| Source in repo | Both repositories are local, licensed and documented | Implemented; not published |
| GitHub hosting | Not done | **Manual action required** |
| Public or shared private repo | Not done | **Manual action required** |
| Demo video | Script prepared | **Manual action required** |
| Product feedback | `docs/PRODUCT_FEEDBACK.md` | Implemented |
| Friction log | `docs/FRICTION_LOG.md` | Implemented with observed incidents |
| Open Source mini challenge | FAULTLINE library | Implemented; URLs/publication manual |
| Test evidence | 39 Vitest tests + Playwright E2E | Implemented and run |
| Licensing | MIT in both repos | Implemented |
| Actual MCP usage | Real browser initialize/list/call; protocol tests | Implemented and tested |
| No real purchases/bookings/messages/devices | Enforced by design and copy | Implemented |
| LLM not required | No LLM integration at all | Implemented |

## Unresolved questions and manual checks

1. **Exact deadline timestamp and timezone.** The listing gives only the date. Verify in the Devpost submission form and Official Rules.
2. **Full Official Rules.** The page returned Cloudflare 403. The entrant must read the actual rules for eligibility, age, team representative obligations, submission limits, judging criteria, prize/tax terms and license grants.
3. **Entrant eligibility and age.** Not represented or verified by this project.
4. **GitHub username, repository URLs, contribution URL.** Not invented. Must be supplied after publication.
5. **Private-repo sharing.** If private, invite the five Amazon reviewers and `testing@devpost.com`, and confirm invitations are accepted before the deadline.
6. **Published dependency.** FAULTLINE currently uses a sibling `file:../faultline` dependency. For a stranger to install from the FORKCAST repo alone, publish FAULTLINE and change the dependency to a Git URL or registry package, or instruct clone-both-siblings. This is a reproducibility risk for judging.
7. **Demo video recording.** Must be under 3:00, public, English, and show the app running with real MCP calls.
8. **Product feedback completeness.** Update after the final run if any new tool/API is used.
9. **Open Source "contribution URL".** For a brand-new project, use the repository URL or a tagged release URL. Confirm with the submission form whether it expects a PR URL specifically.
10. **Existing-project disclosure.** Nothing existed before this build; do not claim a pre-existing project.
11. **Prize and tax forms.** Not reviewed.
12. **Amazon affiliation.** FORKCAST is not affiliated with, endorsed by or connected to Amazon. The simulated experience is a local demo.

## Manual submission checklist

- [ ] Read the full Official Rules while logged in.
- [ ] Confirm the exact deadline in the entrant's timezone.
- [ ] Confirm eligibility, age and team status.
- [ ] Publish both GitHub repositories with the MIT license.
- [ ] Ensure FAULTLINE is installable for judges (public repo and/or versioned Git dependency).
- [ ] Verify a clean clone can run using the README instructions.
- [ ] Record the GitHub username and repository URLs in the submission drafts.
- [ ] If private, invite and confirm the required GitHub reviewers.
- [ ] Record a public English demo under 3:00.
- [ ] Confirm no unlicensed music/footage/trademarks.
- [ ] Complete product feedback for every tool used.
- [ ] Attach the Open Source mini-challenge fields.
- [ ] Verify no secrets, API keys or personal data are committed.
- [ ] Confirm the code and claims match the recorded demo.
- [ ] Submit before the verified deadline.

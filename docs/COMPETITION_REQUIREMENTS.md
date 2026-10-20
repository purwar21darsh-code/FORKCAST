# Competition requirements verification

**Verified:** 20 October 2026 (Asia/Calcutta).  
**Deadline found:** Friday, 23 October 2026 at **12:00 PM Pacific Daylight Time (PDT)** — **24 October 2026, 12:30 AM IST** in the entrant's current timezone.  
**Submission period:** Monday, 31 August 2026, 10:15 AM PT – Friday, 23 October 2026, 12:00 PM PT.

The live `/rules` page still returns a Cloudflare 403 challenge. The rules below were read from an archived capture of the official rules on the official Devpost domain, captured **1 October 2026** and matching the 12 September 2026 capture. The archived page header also displayed "Deadline: Oct 23, 2026 @ 12:00pm PDT". The entrant must still re-check the live submission UI before submitting.

## Sources

| Source | What it is | Access result |
| --- | --- | --- |
| <https://amazonappdev2026.devpost.com/> | Official hackathon home | Read through a text-rendering proxy; Cloudflare blocks direct browser access. |
| <https://amazonappdev2026.devpost.com/details/faqs> | Official FAQ | Read through a text-rendering proxy. |
| <https://amazonappdev2026.devpost.com/rules> | Official Rules (live) | **Blocked:** HTTP 403 "Just a moment" Cloudflare challenge, including a real Chrome attempt. |
| <https://web.archive.org/web/20261001091311id_/https://amazonappdev2026.devpost.com/rules> | Archived official rules page on the official domain, 1 October 2026 | Read; deadline, eligibility, submission terms, judging and video rules extracted. |
| <https://web.archive.org/web/20260912015439id_/https://amazonappdev2026.devpost.com/rules> | Earlier official rules capture, 12 September 2026 | Read; same deadline and core rules. |
| <https://devpost.com/api/hackathons?search=build%20ship%20shape> | Devpost public listing API | Returned **Aug 31 – Oct 23, 2026** and "4 days left" on 20 October 2026. |
| <https://github.com/modelcontextprotocol/typescript-sdk/tree/v1.x> | Official MCP TypeScript SDK v1 README | Read; v1.32.1 implements MCP **2025-11-25**. |
| <https://modelcontextprotocol.io/specification/2025-11-25> | MCP specification | Required target named in the rules. |
| <https://github.com/modelcontextprotocol/typescript-sdk> | SDK main branch | v2 packages implement 2026-07-28; this project intentionally uses v1.32.1 for the track's required 2025-11-25 spec. |

## Verified requirements

### Dates and timing

- Submission Period: **31 August 2026, 10:15 AM PT – 23 October 2026, 12:00 PM PT**.
- Deadline header on the official page: **Oct 23, 2026 @ 12:00pm PDT**.
- In **Asia/Calcutta**, that is **24 October 2026, 12:30 AM IST**. The entrant must re-check this in the Devpost submission UI in case the live rules changed after the archive date.
- Judging Period: **9 November 2026, 12:00 PM PT – 20 November 2026, 12:00 PM PT**.
- Winners announced: on or around **3 December 2026, 12:00 PM PT**.
- AWS credit request deadline in the archived rules: **21 October 2026, 12:00 PM PT** (not used by this project).

### Entrant and team

- Open to individuals at least the **age of majority where they reside** at entry.
- Open to teams of Eligible Individuals and to qualifying organizations.
- A team or organization must appoint one authorized **Representative** to submit and act on its behalf.
- Not open to residents/domiciliaries of prohibited jurisdictions; named examples include **Brazil, Quebec, Russia, Crimea, Cuba, Iran, North Korea** and other comprehensively OFAC-sanctioned countries.
- Not open to promotion entities, their employees/agents and immediate family/household, judges, related affiliates, or conflicts of interest.
- Multiple submissions are allowed, but each must be unique and substantially different.
- This build does not assert or verify the user's age, residency, eligibility, team status or representative authority. Those are manual checks.

### Project requirements

- Build or significantly update a working application using the required developer tools for the chosen track.
- **Alexa+:** build a working **Agent Skill** or **self-hosted MCP server** implementing **MCP 2025-11-25 or later** over **Streamable HTTP**. Optionally simulate the Alexa+ experience in a web app using the entrant's own agentic tools.
- A simulated experience is explicitly allowed. It is exempt from the runtime-technology-hook requirement, but the repository must include the simulation's source code and the video must clearly show it.
- The repository must demonstrate the track technology at runtime in code — imported and actually called — for Alexa+, Bee and Ring; Fire TV is the device exception.
- The project must be shown functioning in the demo video, as described in the submission.
- The project must be new, or significantly updated after the start of the Submission Period. FORKCAST and FAULTLINE are new.
- Third-party SDKs, APIs and data must be used in accordance with their licenses and terms.
- The project must be accessible to judges for testing/evaluation free of charge until judging ends.

### Alexa+ compliance for this build

- **FORKCAST uses MCP 2025-11-25 over Streamable HTTP**, with the official TypeScript SDK 1.32.1.
- **The browser is an actual MCP client:** initialization, tools/list and tools/call are observable in the UI and tested.
- The app is explicitly described as a **simulated household experience**, not an Alexa+ integration.
- No gated Alexa+ Category SDK, MCP Toolkit, CLI or Web Simulator was used or accessed.
- No physical Alexa device is required.
- The local repository includes both the MCP server and browser simulation source.
- Hosting is not required; a locally runnable repository plus video is sufficient.

### Submission artefacts

- Text description explaining features and how it works.
- **GitHub code repository** containing all necessary source, assets and instructions. GitLab or another host is explicitly not accepted.
- Repository must be **public with an open-source license visible at the top of the repository page**, or **private and shared** with `testing@devpost.com` and all listed Amazon reviewers.
- Archived rules reviewer usernames: **`chris-trag`**, `knmeiss`, `giolaq`, `anishamalde`, `mosesroth`, `emersonsklar`. The FAQ also lists five of these; include `chris-trag` for the current rules.
- Private invitations must be accepted before the deadline; GitHub invitations expire after 7 days.
- Demo video: **under 3 minutes**, public on **YouTube or Vimeo**, English, showing the project functioning on its intended platform; no unlicensed third-party trademarks, music or footage.
- Product feedback for each tool/API/SDK used: purpose, what worked, what needs work, onboarding, and whether the developer would use it again.
- Identify primary track(s) and mini challenge(s).
- Open Source mini challenge requires contribution URL, project repository URL, GitHub username, and a description of what was done, how it works and why it matters.
- Optional feature requests and optional friction-log entries; friction logs can earn up to a **10% bonus** in Stage 1/Stage 2 judging.
- All materials must be in English (or have an English translation).
- Submission must be original work, solely owned by the entrant/team/organization, and not violate IP or privacy rights.
- A project must not have been developed with financial or preferential support from the Sponsor or Administrator.

### Judging criteria

Stage One is pass/fail viability: fit with the theme and reasonable use of required APIs/SDKs.

Stage Two uses **four equally weighted criteria**:

1. **Tech Implementation** — how well it is built and how effectively it uses the required technology.
2. **Design** — complete, coherent product experience and intuitive interaction model.
3. **Potential Impact** — credible, specific customer need and realistic audience.
4. **Quality of the Idea** — creative, imaginative use of the tools and genuine ecosystem/user understanding.

For Alexa+, the rules explicitly call out a single-turn Q&A bot and a basic MCP wrapper as obvious; agentic workflows, context-aware state across sessions and richer capabilities are described as more creative. FORKCAST's counterfactual branch/repair/approval model is intended to sit in the latter category without overstating it.

### Open Source mini challenge

- Create a **new, additional open-source project** (with an open-source license), or contribute to an existing public repository, during the hackathon window.
- Contributions can be a new repo, branch, fork or pull request; PRs do not need to be merged.
- Required fields: contribution URL, project repository URL, GitHub username, and a description of what was done, how it works and why it matters.
- FAULTLINE is a new, separate MIT-licensed library. FORKCAST uses it as a real dependency. Repository and contribution URLs remain unset until the user publishes them. No URL, PR, stars or adoption is invented.

### Licensing

- A public repository must include a visible open-source license file. MIT was selected for both repositories.
- The MIT license is compatible with the included MIT-licensed MCP SDK.
- Dependency license review (20 Oct 2026): the lockfiles contain MIT, ISC, BSD, Apache-2.0, CC-BY-4.0 data and MPL-2.0 dev-only packages; no GPL/AGPL. Review notices and attribution requirements before distribution. This is not legal advice.

### Demo, language and accessibility

- Maximum **3 minutes**; public, English, YouTube/Vimeo.
- No third-party trademarks or copyrighted media without permission.
- Demo must show the real project, not fabricated results.
- The UI includes keyboard focus, visible focus, accessible names, text status labels, reduced motion and responsive layouts. No separate official accessibility requirement beyond video/submission rules was found.

### Product feedback and friction

- Product feedback is mandatory for every tool/API/SDK used.
- Friction logs are optional and can earn up to 10%.
- Only real incidents are recorded. No bugs were manufactured.

## Compliance mapping for FORKCAST

| Requirement | How this build addresses it | Status |
| --- | --- | --- |
| Alexa+ track MCP path | Self-hosted MCP server, 2025-11-25, Streamable HTTP | Implemented and tested |
| Simulated experience permitted | Browser workstation + real MCP client | Implemented and tested |
| Runtime technology hook | MCP server imported/used; browser initialization/list/call tested | Implemented |
| Source in repo | Both repositories are public, MIT-licensed and documented | Implemented and published |
| GitHub hosting | <https://github.com/purwar21darsh-code/FORKCAST> and <https://github.com/purwar21darsh-code/faultline> | Published |
| Public or shared private repo | Public repositories; no private sharing needed | Published |
| Demo video | Script prepared | **Manual action required** |
| Product feedback | `docs/PRODUCT_FEEDBACK.md` | Implemented |
| Friction log | `docs/FRICTION_LOG.md` | Implemented with observed incidents |
| Open Source mini challenge | FAULTLINE v0.1.0, <https://github.com/purwar21darsh-code/faultline/releases/tag/v0.1.0> | Published |
| Test evidence | 39 Vitest tests + Playwright E2E | Implemented and run |
| Licensing | MIT in both repos | Implemented |
| Actual MCP usage | Real browser initialize/list/call; protocol tests | Implemented and tested |
| No real purchases/bookings/messages/devices | Enforced by design and copy | Implemented |
| LLM not required | No LLM integration at all | Implemented |

## Unresolved questions and manual checks

1. **Verify the live rules page and submission UI.** The live rules page is Cloudflare-blocked; the archived official rules confirm the deadline and terms. Re-check before the deadline in case of changes after 1 October 2026.
2. **Entrant eligibility and age.** The project does not assert or verify them.
3. **GitHub username, repository URLs, contribution URL.** Published under `purwar21darsh-code`: [FORKCAST](https://github.com/purwar21darsh-code/FORKCAST), [FAULTLINE](https://github.com/purwar21darsh-code/faultline), [v0.1.0 release](https://github.com/purwar21darsh-code/faultline/releases/tag/v0.1.0).
4. **Private-repo sharing.** If private, invite `chris-trag`, `knmeiss`, `giolaq`, `anishamalde`, `mosesroth`, `emersonsklar` and `testing@devpost.com`, and confirm acceptance before the deadline.
5. **Published dependency.** Resolved: FORKCAST pins `faultline-sim` to the published FAULTLINE v0.1.0 release tarball. A clean clone installs and builds without a sibling checkout or SSH credentials.
6. **Demo video recording.** Must be under 3:00, public, English, and show the app running with real MCP calls.
7. **Product feedback completeness.** Update after the final run if any new tool/API is used.
8. **Open Source "contribution URL".** For a brand-new project, use the repository URL or a tagged release URL. Confirm the form's exact expectation.
9. **Existing-project disclosure.** Nothing existed before this build; do not claim a pre-existing project.
10. **Prize and tax forms.** Not reviewed.
11. **Amazon affiliation.** FORKCAST is not affiliated with, endorsed by or connected to Amazon. The simulated experience is a local demo.

## Manual submission checklist

- [ ] Re-check the live Official Rules while logged in.
- [ ] Confirm **23 October 2026, 12:00 PM PDT / 24 October 2026, 12:30 AM IST** in the submission UI.
- [ ] Confirm eligibility, age, residency and team representative status.
- [x] Publish both GitHub repositories with the MIT license visible.
- [x] Ensure FAULTLINE is installable for judges.
- [x] Verify a clean clone can run using the README.
- [x] Add the GitHub username and repository URLs to the submission drafts.
- [x] Public repositories selected; no private invitations needed.
- [ ] Record a public English demo under 3:00.
- [ ] Confirm no unlicensed music/footage/trademarks.
- [ ] Complete product feedback for every tool/API/SDK.
- [ ] Attach the Open Source mini-challenge fields.
- [ ] Verify no secrets, API keys or personal data are committed.
- [ ] Confirm the code and claims match the recorded demo.
- [ ] Submit before the deadline.
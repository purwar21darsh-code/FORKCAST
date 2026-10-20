# Product feedback

This is raw material for the required submission feedback field. Only tools and APIs actually used in this build are listed. No AWS service and no gated Alexa+ developer tool was used.

## Node.js 24.22.0

**Used for:** server runtime, tests, build tooling.

**Worked well:** stable ESM, native `fetch`, `structuredClone`, `node:test`-free Vitest workflow, easy local HTTP server.

**Needs work:** nothing material for this project.

**Would use again:** yes.

## npm 11.19.1 on Windows

**Used for:** dependency installation and lockfiles.

**Worked well:** deterministic lockfiles and `npm.cmd` worked reliably with the local file dependency. This build used `--no-audit` during installation for speed, so it is **not** a substitute for a dependency security audit.

**Needs work:** PowerShell execution policy blocked `npm.ps1` on the build machine. Also, npm 11 printed an `allowScripts` warning for esbuild's postinstall even though the build worked. See friction entries FR-001 and FR-005.

**Would use again:** yes, with `npm.cmd` documented on Windows.

## TypeScript 5.9.3, strict mode

**Used for:** all server/domain code and web types.

**Worked well:** caught real integration mismatches, especially optional fields, tool payloads and scheduler states.

**Needs work:** strict `exactOptionalPropertyTypes` exposed an incompatibility with the MCP SDK's transport class/interface typing. See FR-002.

**Would use again:** yes.

## @modelcontextprotocol/sdk 1.32.1

**Used for:** MCP server (`McpServer`, `StreamableHTTPServerTransport`), browser client (`Client`, `StreamableHTTPClientTransport`), protocol tests.

**Worked well:**

- Implements the required MCP 2025-11-25 specification.
- The same package supports the browser bundle and the Node server.
- Tool discovery and calls worked first time after correct transport setup.
- Structured tool content, annotations and `isError` responses were enough for a real UI.
- The SDK negotiated the protocol version correctly.

**Needs work:** the `exactOptionalPropertyTypes` transport typing friction required a small cast on both client and server. See FR-002. The package does not ship its docs/examples in the installed package, so developers must use the repository/README.

**Would use again:** yes.

## React 19.3.1 / Vite 7.3.7

**Used for:** the interactive workstation.

**Worked well:** fast local HMR, simple production build, SVG rendering, no runtime state library needed.

**Needs work:** the Vite watcher hit a Windows `EBUSY` when a transient temp directory appeared under `web/src`. See FR-003. The browser bundle is about 542 kB minified / 161 kB gzip because the MCP SDK and schema validation are included; code splitting would be the next improvement.

**Would use again:** yes.

## Vitest 5.0.5

**Used for:** 39 scheduler, scenario, repair, persistence, commit and real MCP protocol tests.

**Worked well:** fast, straightforward TypeScript ESM, easy server lifecycle in tests.

**Needs work:** no blocking issue.

**Would use again:** yes.

## Playwright 1.64.1 + Google Chrome

**Used for:** the end-to-end acceptance test and screenshots.

**Worked well:** real browser MCP client, real components, responsive viewports, cancellation and persistent server restart.

**Needs work:** waiting for `networkidle` never settles because the MCP Streamable HTTP client intentionally holds an SSE stream. The test uses DOM/selector waits instead. That is expected protocol behavior, not a defect.

**Would use again:** yes.

## FAULTLINE (this project's library)

**Used for:** baseline/scenario cloning, one-fault-per-copy execution, captured errors and structured comparison.

**Worked well:** separating the generic matrix from the household scheduler kept the scenario code small and the isolation tests direct.

**Needs work:** the library is synchronous and not a security sandbox. The README says so explicitly. There is no async simulator support yet.

**Would use again:** yes, especially for agent-workflow tests.

## Devpost

**Used for:** rules, FAQs and submission requirements.

**Worked well:** the FAQ and home page were readable through a text-rendering proxy and answered the Alexa+ simulated-experience question clearly.

**Needs work:** the Official Rules page consistently returned a Cloudflare 403 challenge, even in a real Chrome session. That prevented verification of the exact deadline timezone and full legal terms. See FR-004.

**Would use again:** required for submission; the user must verify the rules manually.

## Amazon Alexa+ developer tools

**Used:** none.

The official FAQ states that the Category SDK, MCP Toolkit, CLI and Web Simulator are select-partner preview tools and hackathon participants cannot apply for access. This project therefore used the explicitly permitted self-hosted MCP + simulated web experience path. No claim of Alexa+ integration is made.

## AWS

**Used:** none. No Bedrock, AgentCore, Lambda or other AWS service is part of this build. The AWS Builder mini challenge is not being claimed.
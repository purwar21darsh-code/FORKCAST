# Competition Requirements

## Status: Based on available information as of development time

> **IMPORTANT:** This document distinguishes confirmed requirements from uncertainties.
> Always verify against the official Devpost page before submitting.

## Amazon App Developer Contest 2026

### Official URLs (to be verified)
- Main page: https://amazonappdev2026.devpost.com/
- Rules: https://amazonappdev2026.devpost.com/rules
- FAQs: https://amazonappdev2026.devpost.com/details/faqs
- Resources: https://amazonappdev2026.devpost.com/resources

### Alexa+ Track Requirements (UNCONFIRMED — verify before submission)

**What we know:**
- The contest has an Alexa+ track for building skills/apps
- MCP (Model Context Protocol) integration is relevant
- Streamable HTTP transport may be required for MCP

**What we built:**
- MCP tool definitions matching the protocol structure
- Tool discovery and invocation via client
- Seven registered tools with input schemas
- Deterministic simulation (no external AI APIs required)

**Uncertainties:**
- Exact MCP SDK version required
- Whether Streamable HTTP transport is mandatory vs. SSE
- Whether the app must be a functional Alexa skill or can be a standalone demo
- Submission format (video, code repository, live demo)

### Open Source Mini-Challenge

**Requirements (UNCONFIRMED):**
- Must be a reusable open-source library
- Must have appropriate license (MIT used)
- Must have documentation, tests, and examples
- Must be independently useful

**What we built (FAULTLINE):**
- Independent TypeScript library
- MIT license
- Type-safe API with generics
- Input validation and error handling
- State isolation guarantees
- Runnable examples
- Formatted test reports

**Uncertainties:**
- Whether it must be published to npm
- Whether it needs a separate GitHub repository
- Minimum test coverage requirements
- Whether it must be used by the main project

## FORKCAST Compliance Notes

### What we've implemented:
1. ✅ MCP protocol tool definitions and client
2. ✅ Deterministic simulation (no paid AI APIs needed)
3. ✅ Real scheduling engine with dependency awareness
4. ✅ Four fault scenarios with actual calculations
5. ✅ Repair planner with honest feasibility reporting
6. ✅ Approval-gated commit (no automatic changes)
7. ✅ Activity logging of all operations
8. ✅ State isolation (original world never mutated during simulation)
9. ✅ Duplicate commit prevention
10. ✅ Reset functionality

### What needs manual verification:
1. ⚠️ Whether a real MCP server (not just protocol logic) is required
2. ⚠️ Whether the app must integrate with actual Alexa+ APIs
3. ⚠️ Exact submission format and deadline
4. ⚠️ Eligibility requirements (age, location, team size)
5. ⚠️ Whether FAULTLINE must be published as a separate npm package

### Actions Before Submission:
1. Verify all URLs on Devpost are current
2. Read the full rules document
3. Check if Alexa+ integration is mandatory
4. Confirm MCP transport requirements
5. Verify FAULTLINE licensing and publication requirements
6. Record a demo video matching the required duration
7. Prepare submission text with verified claims only

## MCP SDK Reference

**Repository:** https://github.com/modelcontextprotocol/typescript-sdk

**Key concepts implemented:**
- Tool definitions with JSON Schema input
- Client initialization and tool discovery
- Tool invocation with structured results
- Error handling for invalid arguments

**What's simulated vs. real:**
- Tool definitions: Real (matching protocol structure)
- Client initialization: Simulated (no actual HTTP connection)
- Tool invocation: Real logic, simulated transport
- Results: Computed deterministically by the engine

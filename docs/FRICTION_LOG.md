# Friction log

Only incidents observed during this build are recorded. These are not invented bug reports. Severity is relative to a hackathon build on Windows.

---

## FR-001 — npm PowerShell shim blocked by execution policy

**Product/tool:** npm 11.19.1, Windows PowerShell.

**Task attempted:** check the npm version and install dependencies.

**Reproduction:**

```powershell
npm --version
```

**Expected:** npm version prints.

**Actual:**

```
npm.ps1 cannot be loaded because running scripts is disabled on this system.
```

**Severity:** medium (blocks the obvious command).

**Workaround:** use `npm.cmd` for every command:
```powershell
npm.cmd --version
npm.cmd install
```

**Suggestion:** document `npm.cmd` prominently for Windows contributors, or detect the shim failure and print a PowerShell-specific recovery hint.

**Observed:** yes, in this environment.

---

## FR-002 — MCP SDK transport types reject strict optional properties

**Product/tool:** `@modelcontextprotocol/sdk` 1.32.1, TypeScript 5.9.3, `exactOptionalPropertyTypes: true`.

**Task attempted:** type-check a real Streamable HTTP client and server.

**Reproduction:** enable `exactOptionalPropertyTypes`, then pass `StreamableHTTPClientTransport` to `Client.connect` or `StreamableHTTPServerTransport` to `McpServer.connect`.

**Expected:** the SDK's transport classes are assignable to its `Transport` interface.

**Actual:** TS2379 — the class exposes optional callbacks/properties as `T | undefined`, while the interface expects the property to be absent or `T`.

```text
Type 'StreamableHTTPClientTransport' is not assignable to type 'Transport'.
  Types of property 'sessionId' are incompatible.
    Type 'string | undefined' is not assignable to type 'string'.
```

**Severity:** low–medium (type-only; runtime works).

**Workaround:** narrow/cast at the two connect boundaries:
```ts
await client.connect(transport as unknown as Transport);
await server.connect(transport as unknown as Transport);
```

**Suggestion:** make the `Transport` interface optional-property-compatible, or publish a documented helper that accepts the SDK transport classes under strict mode.

**Observed:** yes. Both client and server needed the cast.

---

## FR-003 — Vite watcher EBUSY on a transient temp directory

**Product/tool:** Vite 7.3.7 dev server on Windows 11, with an external editor tool that writes atomically through temporary directories inside `web/src`.

**Task attempted:** keep the Vite dev server running while editing a TS file.

**Reproduction:** edit `web/src/format.ts` with a tool that creates a short-lived `.format.ts.<pid>.<uuid>.tmpdir` beside the file.

**Expected:** Vite ignores or tolerates the transient directory.

**Actual:** the dev server exited with:

```text
Error: EBUSY: resource busy or locked, watch '...\.format.ts....tmpdir\format.ts.tmp'
```

**Severity:** low for the final app; disruptive during development.

**Workaround:** add watcher ignores for temporary directories and rebuild/restart once:
```ts
watch: { ignored: ["**/.*.tmpdir/**", "**/*.tmp", "**/data/**"] }
```

**Suggestion:** ignore dot-prefixed temporary directories in the default watcher, or degrade a single file-watch error instead of terminating the dev server.

**Observed:** yes, once.

---

## FR-004 — Official Rules page blocked by Cloudflare

**Product/tool:** Devpost / `amazonappdev2026.devpost.com`.

**Task attempted:** read the official rules to verify the exact submission deadline and track restrictions.

**Reproduction:** fetch `https://amazonappdev2026.devpost.com/rules` with an HTTP client and with a real headless Chrome session.

**Expected:** the publicly linked rules page is readable before login.

**Actual:** HTTP 403 with "Just a moment... Performing security verification" and a Cloudflare Ray ID. The FAQ and home page were readable through a text-rendering proxy; the rules page was not.

**Severity:** high for compliance verification. The exact deadline timezone and full legal terms remain unverified.

**Workaround:** use the official home/FAQ, the Devpost listing API for the date range, and mark the deadline time and legal terms as **manual verification required** in `docs/COMPETITION_REQUIREMENTS.md`. Do not assume a timezone.

**Suggestion:** provide a static, accessible rules page or a documented public API endpoint for the rules; if Cloudflare protection is necessary, ensure logged-in participants can access a plain-text version.

**Observed:** yes.

---

## FR-005 — npm install-scripts warning for esbuild without failure

**Product/tool:** npm 11.19.1.

**Task attempted:** `npm install`.

**Expected:** install completes with no unexplained warning.

**Actual:** npm warned that `esbuild@0.28.2` has a postinstall script not covered by `allowScripts`, but Vite and Vitest still built and ran successfully. The optional platform binary package was present.

**Severity:** low (noise; potential confusion).

**Workaround:** none needed for this build. If a future install fails, run `npm install-scripts approve esbuild` after reviewing the script.

**Suggestion:** when the script is only a binary check and the optional package is present, say so explicitly in the warning, or add a one-line explanation of the expected outcome.

**Observed:** yes.

---

## Not counted as product friction

- **Playwright `networkidle` timeout:** the MCP Streamable HTTP client intentionally keeps an SSE stream open. The test uses explicit UI waits. This is expected protocol behavior.
- **Cloudflare challenge in headless Chrome:** also part of FR-004.
- **Vite bundle-size warning:** expected because the official MCP SDK and schema validation are bundled. Recorded as technical debt, not a bug.

## Honest summary

Five real incidents were observed. None involved a fake error, a manufactured defect or a fabricated vendor response. The most consequential is FR-004 because it prevents full verification of competition timing; the entrant must check the rules manually before submitting.

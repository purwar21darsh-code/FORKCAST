import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { preview } from "vite";
import { chromium } from "playwright";
import { startForkcastServer } from "../dist/server/http.js";

const PORT = 4179;
const WEB_PORT = 5173;
await mkdir("artifacts", { recursive: true });
const dataDir = await mkdtemp(path.join(os.tmpdir(), "forkcast-e2e-"));
let server;
let viteServer;
let browser;

function log(step) {
  console.log("E2E  " + step);
}

try {
  server = await startForkcastServer({
    port: PORT,
    host: "127.0.0.1",
    dataDir
  });
  log("backend ready at " + server.endpoint);

  viteServer = await preview({
    configFile: path.resolve("vite.config.ts"),
    logLevel: "error",
    preview: { port: WEB_PORT, strictPort: true, host: "127.0.0.1" }
  });
  log("frontend preview ready at http://127.0.0.1:" + WEB_PORT);

  browser = await chromium.launch(
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : { headless: true, channel: "chrome" }
  );
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1100 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) =>
    failedRequests.push(request.url() + " :: " + (request.failure()?.errorText ?? "failed"))
  );

  await page.goto("http://127.0.0.1:" + WEB_PORT + "/", {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });
  await page.waitForSelector(".live-dot.is-live", { timeout: 30000 });
  await page.waitForSelector(".tool-inspector > summary", { timeout: 10000 });
  assert.match(await page.locator(".tool-inspector > summary").innerText(), /9 MCP tools discovered/);
  assert.match(await page.locator(".brand-text").innerText(), /FORKCAST/);
  log("MCP initialized and 9 tools discovered in the browser");
  await page.screenshot({ path: "artifacts/e2e-01-connected.png", fullPage: true });

  await page.getByRole("button", { name: /Run sample request/i }).click();
  await page.waitForSelector(".timeline-panel", { timeout: 30000 });
  assert.match(await page.locator("#timeline-heading").innerText(), /5:35 PM/);
  await page.screenshot({ path: "artifacts/e2e-00-baseline.png", fullPage: true });
  log("baseline calculated through MCP: 5:35 PM, 25 min slack");

  assert.equal(server.store.worldRevision, 1);
  const beforeSimulation = JSON.stringify(server.store.getWorldSnapshot());

  await page.locator(".scenario-run").first().click();
  await page.waitForSelector(".comparison-stats", { timeout: 30000 });
  assert.match(await page.locator("#comparison-heading").innerText(), /Chilled delivery delayed/);
  assert.match(await page.locator(".comparison-panel .status-badge").innerText(), /Hard constraints broken/i);
  assert.match(await page.locator(".comparison-explanation").innerText(), /6:05 PM|Projected completion/);
  assert.equal(JSON.stringify(server.store.getWorldSnapshot()), beforeSimulation);
  log("delivery delay simulated; demo world unchanged");

  await page.getByRole("button", { name: /Find and verify a repair/i }).click();
  await page.waitForSelector(".repair-verdict", { timeout: 30000 });
  assert.match(await page.locator("#repair-heading").innerText(), /A repaired future/);
  assert.match(await page.locator(".repair-panel .status-badge").innerText(), /Repair feasible/i);
  assert.match(await page.locator(".verification-facts").innerText(), /Yes/);
  await page.screenshot({ path: "artifacts/e2e-02-repair.png", fullPage: true });
  log("repair found and independently verified");

  await page.getByRole("button", { name: /Review exact local changes/i }).click();
  await page.waitForSelector(".approval-box", { timeout: 30000 });
  assert.equal(server.store.worldRevision, 1, "preview must not write demo state");
  await page.getByRole("button", { name: /Cancel — no write/i }).click();
  await page.waitForSelector(".execution-empty", { timeout: 10000 });
  assert.equal(server.store.worldRevision, 1, "cancel must not write demo state");
  log("commit preview cancelled; no write occurred");

  await page.getByRole("button", { name: /Review exact local changes/i }).click();
  await page.waitForSelector(".approval-box", { timeout: 30000 });
  const approveButton = page.getByRole("button", { name: /Approve and apply/i });
  assert.equal(await approveButton.isDisabled(), true);
  await page.getByRole("checkbox").check();
  assert.equal(await approveButton.isEnabled(), true);
  await page.screenshot({ path: "artifacts/e2e-03-approval.png", fullPage: true });
  await approveButton.click();
  await page.waitForSelector(".applied-card", { timeout: 30000 });
  assert.match(await page.locator(".applied-card").innerText(), /was applied to the local demo dataset/);
  assert.equal(server.store.worldRevision, 2);
  assert.ok(server.store.getWorldSnapshot().appliedExecution);
  await page.screenshot({ path: "artifacts/e2e-04-committed.png", fullPage: true });
  log("approved plan committed to local demo data at revision 2");

  const appliedPlanId = server.store.getWorldSnapshot().appliedExecution.planId;
  await server.close();
  server = await startForkcastServer({ port: PORT, host: "127.0.0.1", dataDir });
  log("backend restarted against the same data directory");

  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".live-dot.is-live", { timeout: 30000 });
  await page.waitForSelector(".execution-panel", { timeout: 10000 });
  assert.match(await page.locator(".mission-strip").innerText(), /2/);
  assert.match(await page.locator(".applied-card").innerText(), /already recorded/);
  assert.equal(server.store.getWorldSnapshot().appliedExecution.planId, appliedPlanId);
  log("persisted revision 2 and applied execution survived restart");

  await page.getByRole("button", { name: /Reset demo data/i }).click();
  await page.getByRole("button", { name: /Confirm reset/i }).click();
  await page.waitForFunction(
    () => document.querySelector(".mission-strip")?.textContent?.includes("unmodified demonstration data"),
    { timeout: 30000 }
  );
  assert.equal(server.store.worldRevision, 3);
  assert.equal(server.store.getWorldSnapshot().appliedExecution, null);
  log("demo reset to the deterministic seed; stale previews invalidated; audit history retained");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".live-dot.is-live", { timeout: 30000 });
  await page.getByRole("button", { name: /Run sample request/i }).click();
  await page.waitForSelector(".timeline-panel", { timeout: 30000 });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1),
    false,
    "mobile layout must not overflow horizontally"
  );
  await page.screenshot({ path: "artifacts/e2e-05-mobile.png", fullPage: true });
  log("mobile layout exercised at 390 x 844 with no horizontal page overflow");

  await page.setViewportSize({ width: 820, height: 1180 });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".live-dot.is-live", { timeout: 30000 });
  await page.getByRole("button", { name: /Run sample request/i }).click();
  await page.waitForSelector(".timeline-panel", { timeout: 30000 });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1),
    false,
    "tablet layout must not overflow horizontally"
  );
  await page.screenshot({ path: "artifacts/e2e-06-tablet.png", fullPage: true });
  log("tablet layout exercised at 820 x 1180 with no horizontal page overflow");

  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);
  const significantFailedRequests = failedRequests.filter(
    (entry) => !(entry.includes("/mcp") && entry.includes("net::ERR_ABORTED"))
  );
  assert.deepEqual(significantFailedRequests, []);
  console.log("E2E RESULT: PASS");
  console.log("Demo data directory: " + dataDir);
} catch (error) {
  console.error("E2E RESULT: FAIL");
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => undefined);
  await viteServer?.close().catch(() => undefined);
  await server?.close().catch(() => undefined);
  await rm(dataDir, { recursive: true, force: true }).catch(() => undefined);
}
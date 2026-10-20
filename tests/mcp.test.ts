import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { startForkcastServer, type StartedForkcastServer } from "../src/server/http.js";
import type {
  BaselinePayload,
  CommitPayload,
  InspectWorldResult,
  PreviewCommitPayload,
  RepairPayload,
  ScenarioAnalysisPayload
} from "../src/shared/contracts.js";

const tempDirs: string[] = [];
const servers: StartedForkcastServer[] = [];
const clients: Client[] = [];

async function newServer(): Promise<{ dir: string; server: StartedForkcastServer }> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "forkcast-mcp-"));
  tempDirs.push(dir);
  const server = await startForkcastServer({ port: 0, dataDir: dir });
  servers.push(server);
  return { dir, server };
}

async function newClient(server: StartedForkcastServer) {
  const client = new Client({ name: "forkcast-test-client", version: "0.0.1" });
  const transport = new StreamableHTTPClientTransport(new URL(server.endpoint));
  await client.connect(transport);
  clients.push(client);
  return { client, transport };
}

async function callOk<T>(
  client: Client,
  name: string,
  args: Record<string, unknown>
): Promise<T> {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) {
    throw new Error("Tool failed: " + JSON.stringify(result.structuredContent));
  }
  return result.structuredContent as T;
}

afterEach(async () => {
  for (const client of clients.splice(0)) await client.close().catch(() => undefined);
  for (const server of servers.splice(0)) await server.close().catch(() => undefined);
  for (const dir of tempDirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

describe("real MCP protocol over Streamable HTTP", () => {
  it("initializes, negotiates 2025-11-25 and discovers the actual tools", async () => {
    const { server } = await newServer();
    const { client, transport } = await newClient(server);
    expect(transport.protocolVersion).toBe("2025-11-25");
    const tools = await client.listTools();
    expect(tools.tools).toHaveLength(9);
    expect(tools.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "forkcast.inspect_world",
        "forkcast.draft_plan",
        "forkcast.list_scenarios",
        "forkcast.simulate_scenario",
        "forkcast.compare_scenarios",
        "forkcast.repair_plan",
        "forkcast.preview_commit",
        "forkcast.commit_approved_plan",
        "forkcast.reset_demo"
      ])
    );
    const inspect = await callOk<InspectWorldResult>(client, "forkcast.inspect_world", {});
    expect(inspect.worldRevision).toBe(1);
    expect(inspect.server.protocolVersion).toBe("2025-11-25");
    expect(inspect.server.transport).toBe("streamable-http");
    expect(inspect.summary.guestCount).toBe(6);
    const scenarios = await callOk<{ scenarios: unknown[] }>(client, "forkcast.list_scenarios", {});
    expect(scenarios.scenarios).toHaveLength(4);
  });

  it("returns real tool errors for invalid arguments and unknown domain ids", async () => {
    const { server } = await newServer();
    const { client } = await newClient(server);
    const invalid = await client.callTool({
      name: "forkcast.draft_plan",
      arguments: { request: "x" }
    });
    expect(invalid.isError).toBe(true);
    const unknownAnalysis = await client.callTool({
      name: "forkcast.repair_plan",
      arguments: { analysisId: "analysis_does_not_exist" }
    });
    expect(unknownAnalysis.isError).toBe(true);
    const errorPayload = unknownAnalysis.structuredContent as { error?: { code?: string } };
    expect(errorPayload.error?.code).toBe("NO_ANALYSIS");
  });

  it("enforces local CORS policy and handles malformed or sessionless requests", async () => {
    const { server } = await newServer();
    const health = await fetch(server.endpoint.replace("/mcp", "/health"), {
      headers: { Origin: "http://127.0.0.1:5173" }
    });
    expect(health.status).toBe(200);
    expect(health.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:5173");

    const preflight = await fetch(server.endpoint, {
      method: "OPTIONS",
      headers: {
        Origin: "http://127.0.0.1:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type,mcp-session-id"
      }
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:5173");
    expect(preflight.headers.get("access-control-allow-headers")).toContain("Mcp-Session-Id");

    const denied = await fetch(server.endpoint, {
      method: "OPTIONS",
      headers: { Origin: "http://evil.example" }
    });
    expect(denied.status).toBe(403);

    const malformed = await fetch(server.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{broken"
    });
    expect(malformed.status).toBe(400);

    const wrongContentType = await fetch(server.endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} })
    });
    expect(wrongContentType.status).toBe(415);

    const noSession = await fetch(server.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Mcp-Session-Id": "does-not-exist"
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })
    });
    expect(noSession.status).toBe(404);
  });

  it("runs draft, simulation, repair, preview, commit, duplicate rejection, restart and reset", async () => {
    const { dir, server } = await newServer();
    const { client } = await newClient(server);

    const inspectBefore = await callOk<InspectWorldResult>(client, "forkcast.inspect_world", {});
    expect(inspectBefore.worldRevision).toBe(1);
    const paneerBefore = inspectBefore.world.inventory.paneer?.quantity ?? 0;

    const draft = await callOk<BaselinePayload>(client, "forkcast.draft_plan", {
      request: "Prepare my home for six guests at 6 PM and test disruptions."
    });
    expect(draft.schedule.feasible).toBe(true);
    expect(draft.plan.id).toContain("plan-baseline");

    const analysis = await callOk<ScenarioAnalysisPayload>(client, "forkcast.simulate_scenario", {
      scenarioId: "delivery-delay",
      planId: draft.plan.id
    });
    expect(analysis.comparison.verdict).toBe("failed");
    expect(analysis.faulted.schedule.completionMinute).toBe(1085);

    const repair = await callOk<RepairPayload>(client, "forkcast.repair_plan", {
      analysisId: analysis.analysisId
    });
    expect(repair.result.status).toBe("feasible");
    expect(repair.verification?.verified).toBe(true);
    if (!repair.repairedPlan) throw new Error("Expected repaired plan");

    const preview = await callOk<PreviewCommitPayload>(client, "forkcast.preview_commit", {
      planId: repair.repairedPlan.id
    });
    expect(preview.approvalToken.startsWith("approval_")).toBe(true);
    expect(preview.preview.inventoryChanges.length).toBeGreaterThan(0);

    const commit = await callOk<CommitPayload>(client, "forkcast.commit_approved_plan", {
      planId: repair.repairedPlan.id,
      approvalToken: preview.approvalToken,
      approvalText: "APPROVE LOCAL DEMO COMMIT"
    });
    expect(commit.worldRevision).toBe(2);
    expect(commit.world.appliedExecution?.planId).toBe(repair.repairedPlan.id);
    expect(commit.world.inventory.paneer?.quantity).toBeLessThan(paneerBefore);

    const duplicate = await client.callTool({
      name: "forkcast.commit_approved_plan",
      arguments: {
        planId: repair.repairedPlan.id,
        approvalToken: preview.approvalToken,
        approvalText: "APPROVE LOCAL DEMO COMMIT"
      }
    });
    expect(duplicate.isError).toBe(true);
    const duplicatePayload = duplicate.structuredContent as { error?: { code?: string } };
    expect(["ALREADY_COMMITTED", "ALREADY_APPLIED"]).toContain(duplicatePayload.error?.code);

    const committedInspect = await callOk<InspectWorldResult>(client, "forkcast.inspect_world", {});
    expect(committedInspect.worldRevision).toBe(2);
    expect(committedInspect.appliedExecution?.planId).toBe(repair.repairedPlan.id);
    expect(committedInspect.activity.some((event) => event.type === "COMMIT_REJECTED")).toBe(true);

    // Restart the backend against the same data directory.
    await client.close();
    clients.splice(clients.indexOf(client), 1);
    await server.close();
    servers.splice(servers.indexOf(server), 1);

    const restarted = await startForkcastServer({ port: 0, dataDir: dir });
    servers.push(restarted);
    const { client: restartedClient } = await newClient(restarted);
    const afterRestart = await callOk<InspectWorldResult>(
      restartedClient,
      "forkcast.inspect_world",
      {}
    );
    expect(afterRestart.worldRevision).toBe(2);
    expect(afterRestart.appliedExecution?.planId).toBe(repair.repairedPlan.id);

    const reset = await callOk<{ worldRevision: number; world: unknown }>(
      restartedClient,
      "forkcast.reset_demo",
      { confirmation: "RESET DEMO DATA" }
    );
    expect(reset.worldRevision).toBe(3);
    const afterReset = await callOk<InspectWorldResult>(
      restartedClient,
      "forkcast.inspect_world",
      {}
    );
    expect(afterReset.worldRevision).toBe(3);
    expect(afterReset.appliedExecution).toBeNull();
    expect(afterReset.activity.some((event) => event.type === "DEMO_RESET")).toBe(true);
  });
});
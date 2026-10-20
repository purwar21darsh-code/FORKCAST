import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { APPROVAL_PHRASE, type ForkcastService } from "./service.js";
import type { ErrorPayload } from "../shared/contracts.js";

function asStructured(payload: object): Record<string, unknown> {
  return payload as unknown as Record<string, unknown>;
}

function ok(payload: object, text?: string): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: text ?? JSON.stringify(payload, null, 2)
      }
    ],
    structuredContent: asStructured(payload)
  };
}

function failure(service: ForkcastService, error: unknown): CallToolResult {
  const payload: ErrorPayload = service.toErrorPayload(error);
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2)
      }
    ],
    structuredContent: asStructured(payload)
  };
}

/**
 * Registers the real MCP tools. Every handler calls the tested domain service.
 */
export function createForkcastMcpServer(service: ForkcastService): McpServer {
  const server = new McpServer(
    { name: "forkcast", version: "0.1.0" },
    {
      instructions:
        "FORKCAST stress-tests a deterministic six-guest dinner plan in a local simulated household. All times are calculated. Simulations never mutate demo state. Committing requires a preview token and the exact explicit approval phrase. No real purchases, messages, bookings or devices are used."
    }
  );

  server.registerTool(
    "forkcast.inspect_world",
    {
      title: "Inspect the simulated household",
      description:
        "Return the actual local simulated world, frozen seed metadata, inventory, deliveries, resources, meal definitions, current demo revision, applied execution and recent audit events. Read-only.",
      inputSchema: {},
      annotations: {
        title: "Inspect the simulated household",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async () => {
      try {
        return ok(await service.inspectWorld());
      } catch (error) {
        return failure(service, error);
      }
    }
  );

  server.registerTool(
    "forkcast.draft_plan",
    {
      title: "Draft and calculate a baseline plan",
      description:
        "Route the natural-language request to the fixed six-guest demo seed, generate the defined meal plan and run the deterministic dependency/resource scheduler. Returns calculated task times and hard-constraint evidence, not language-model guesses.",
      inputSchema: {
        request: z
          .string()
          .min(3)
          .max(600)
          .describe("The user's request. The judged demo uses the fixed dinner seed regardless of wording.")
      },
      annotations: {
        title: "Draft and calculate a baseline plan",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false
      }
    },
    async ({ request }) => {
      try {
        return ok(await service.draftPlan(request));
      } catch (error) {
        return failure(service, error);
      }
    }
  );

  server.registerTool(
    "forkcast.list_scenarios",
    {
      title: "List supported fault scenarios",
      description:
        "Return the four seeded fault definitions, their parameters and the exact state fields they affect. Read-only.",
      inputSchema: {},
      annotations: {
        title: "List supported fault scenarios",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async () => {
      try {
        return ok(service.listScenarios());
      } catch (error) {
        return failure(service, error);
      }
    }
  );

  server.registerTool(
    "forkcast.simulate_scenario",
    {
      title: "Simulate one isolated fault scenario",
      description:
        "Use FAULTLINE to apply exactly one fault to a fresh clone of the world, run the deterministic scheduler and return baseline, faulted and newly violated constraints. The demo world is not mutated.",
      inputSchema: {
        scenarioId: z
          .string()
          .min(1)
          .describe("One of: delivery-delay, chicken-unavailable, roast-overrun, dishwasher-offline"),
        planId: z.string().min(1).describe("A plan id returned by forkcast.draft_plan.")
      },
      annotations: {
        title: "Simulate one isolated fault scenario",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false
      }
    },
    async ({ scenarioId, planId }) => {
      try {
        return ok(await service.simulateScenario(scenarioId, planId));
      } catch (error) {
        return failure(service, error);
      }
    }
  );

  server.registerTool(
    "forkcast.compare_scenarios",
    {
      title: "Compare the scenario matrix",
      description:
        "Run selected (or all four) isolated fault scenarios against the same plan and return each calculated comparison plus a summary. The demo world is not mutated.",
      inputSchema: {
        planId: z.string().min(1).describe("A plan id returned by forkcast.draft_plan."),
        scenarioIds: z
          .array(z.string().min(1))
          .max(4)
          .optional()
          .describe("Optional subset of scenario ids. Defaults to all four.")
      },
      annotations: {
        title: "Compare the scenario matrix",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false
      }
    },
    async ({ planId, scenarioIds }) => {
      try {
        return ok(await service.compareScenarios(planId, scenarioIds));
      } catch (error) {
        return failure(service, error);
      }
    }
  );

  server.registerTool(
    "forkcast.repair_plan",
    {
      title: "Search for and verify a repaired plan",
      description:
        "After a failed scenario, search defined meal alternatives and deterministic task-order profiles. A repair is reported only after an independent scheduler verification against the faulted world. Hard constraints are never relaxed.",
      inputSchema: {
        analysisId: z
          .string()
          .min(1)
          .describe("The analysisId returned by forkcast.simulate_scenario.")
      },
      annotations: {
        title: "Search for and verify a repaired plan",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false
      }
    },
    async ({ analysisId }) => {
      try {
        return ok(await service.repairPlan(analysisId));
      } catch (error) {
        return failure(service, error);
      }
    }
  );

  server.registerTool(
    "forkcast.preview_commit",
    {
      title: "Preview the exact local demo changes",
      description:
        "Re-schedule the selected proposal against the current demo world and return the exact inventory decrements, execution record and revision change. Generates a single-use five-minute approval token. Does not mutate demo state.",
      inputSchema: {
        planId: z.string().min(1).describe("A feasible proposal id.")
      },
      annotations: {
        title: "Preview the exact local demo changes",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false
      }
    },
    async ({ planId }) => {
      try {
        return ok(await service.previewCommit(planId));
      } catch (error) {
        return failure(service, error);
      }
    }
  );

  server.registerTool(
    "forkcast.commit_approved_plan",
    {
      title: "Apply an explicitly approved plan to local demo data",
      description:
        "Requires a valid single-use preview token and the exact phrase APPROVE LOCAL DEMO COMMIT. Writes only to the dedicated local demo dataset, records the execution and audit event, and rejects stale or repeated commits. No real-world action.",
      inputSchema: {
        planId: z.string().min(1),
        approvalToken: z.string().min(10),
        approvalText: z.string().min(1)
      },
      annotations: {
        title: "Apply an explicitly approved plan to local demo data",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false
      }
    },
    async ({ planId, approvalToken, approvalText }) => {
      try {
        return ok(
          await service.commitApprovedPlan({ planId, approvalToken, approvalText })
        );
      } catch (error) {
        return failure(service, error);
      }
    }
  );

  server.registerTool(
    "forkcast.reset_demo",
    {
      title: "Reset the dedicated demo dataset",
      description:
        "Restore only the local simulated household data to its deterministic seed. Requires the exact confirmation RESET DEMO DATA. Audit history is preserved. Project files are not touched.",
      inputSchema: {
        confirmation: z.string().min(1)
      },
      annotations: {
        title: "Reset the dedicated demo dataset",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false
      }
    },
    async ({ confirmation }) => {
      try {
        return ok(await service.resetDemo(confirmation));
      } catch (error) {
        return failure(service, error);
      }
    }
  );

  return server;
}

export { APPROVAL_PHRASE };
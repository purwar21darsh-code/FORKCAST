/**
 * FORKCAST MCP Protocol Layer
 * 
 * Implements the Model Context Protocol tool definitions and invocation logic.
 * In production, this connects to a real MCP server at localhost:4179/mcp.
 * In this demo, it simulates the protocol with deterministic results.
 */

import type { WorldState, SimulationOutcome, FaultScenario, RepairedPlan, ComparisonResult, ActivityLogEntry, MCPToolResult } from '../engine/types';
import { createSeedWorld, cloneWorld } from '../engine/worldModel';
import { simulateWorld } from '../engine/scheduler';
import { createFaultScenarios, applyFault, attemptRepair } from '../engine/faultEngine';

// ============================================================
// MCP TOOL DEFINITIONS
// ============================================================

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

export const MCP_TOOLS: MCPToolDefinition[] = [
  {
    name: 'forkcast.inspect_world',
    description: 'Inspect the current world state including inventory, resources, tasks, and constraints',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'forkcast.draft_plan',
    description: 'Generate a baseline schedule for the selected meal plan',
    inputSchema: {
      type: 'object',
      properties: {
        mealId: { type: 'string', description: 'ID of the meal option to plan for' },
      },
      required: [],
    },
  },
  {
    name: 'forkcast.list_scenarios',
    description: 'List all available fault scenarios that can be tested',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'forkcast.simulate_scenario',
    description: 'Apply a fault scenario and simulate its impact on the plan',
    inputSchema: {
      type: 'object',
      properties: {
        scenarioId: { type: 'string', description: 'ID of the fault scenario to simulate' },
      },
      required: ['scenarioId'],
    },
  },
  {
    name: 'forkcast.compare_scenarios',
    description: 'Compare baseline plan against all fault scenarios with repair attempts',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'forkcast.repair_plan',
    description: 'Attempt to repair a plan that failed under a specific fault scenario',
    inputSchema: {
      type: 'object',
      properties: {
        scenarioId: { type: 'string', description: 'ID of the fault scenario to repair' },
      },
      required: ['scenarioId'],
    },
  },
  {
    name: 'forkcast.commit_approved_plan',
    description: 'Commit an approved plan to the world state (requires explicit approval)',
    inputSchema: {
      type: 'object',
      properties: {
        planId: { type: 'string', description: 'ID of the plan to commit' },
        approved: { type: 'boolean', description: 'Must be true to proceed' },
      },
      required: ['planId', 'approved'],
    },
  },
];

// ============================================================
// MCP SERVER STATE
// ============================================================

interface ServerState {
  world: WorldState;
  baselineOutcome: SimulationOutcome | null;
  scenarioResults: Map<string, { scenario: FaultScenario; outcome: SimulationOutcome; repair: RepairedPlan | null }>;
  committedPlans: Set<string>;
  activityLog: ActivityLogEntry[];
  pendingApproval: { planId: string; plan: any } | null;
}

function createServerState(): ServerState {
  return {
    world: createSeedWorld(),
    baselineOutcome: null,
    scenarioResults: new Map(),
    committedPlans: new Set(),
    activityLog: [],
    pendingApproval: null,
  };
}

let serverState: ServerState = createServerState();

function addLog(action: string, details: string, status: ActivityLogEntry['status'] = 'info'): void {
  serverState.activityLog.push({
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    action,
    details,
    status,
  });
}

// ============================================================
// TOOL HANDLERS
// ============================================================

function handleInspectWorld(): MCPToolResult {
  const world = serverState.world;
  addLog('inspect_world', `Inspected world "${world.id}" — ${world.tasks.length} tasks, ${Object.keys(world.inventory.ingredients).length} ingredients`);

  return {
    success: true,
    toolName: 'forkcast.inspect_world',
    data: {
      worldId: world.id,
      seed: world.seed,
      deadline: world.deadline,
      currentTime: world.currentTime,
      selectedMeal: world.selectedMeal,
      inventory: Object.values(world.inventory.ingredients).map(i => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        availableAt: i.availableAt,
      })),
      resources: world.resources.map(r => ({
        id: r.id,
        name: r.name,
        available: r.available,
      })),
      tasks: world.tasks.map(t => ({
        id: t.id,
        name: t.name,
        duration: t.duration,
        dependencies: t.dependencies.map(d => d.taskId),
        requiredResources: t.requiredResources,
        criticalPath: t.criticalPath,
      })),
      mealOptions: world.mealOptions.map(m => ({
        id: m.id,
        name: m.name,
        description: m.description,
      })),
      version: world.version,
    },
  };
}

function handleDraftPlan(args: { mealId?: string }): MCPToolResult {
  if (args.mealId) {
    const meal = serverState.world.mealOptions.find(m => m.id === args.mealId);
    if (meal) {
      serverState.world.selectedMeal = args.mealId;
    }
  }

  const outcome = simulateWorld(serverState.world, 'baseline');
  serverState.baselineOutcome = outcome;

  addLog(
    'draft_plan',
    `Generated baseline plan: ${outcome.feasible ? 'FEASIBLE' : 'INFEASIBLE'}, completes at T+${outcome.completionTime}min`,
    outcome.feasible ? 'success' : 'error'
  );

  return {
    success: true,
    toolName: 'forkcast.draft_plan',
    data: {
      mealId: serverState.world.selectedMeal,
      outcome,
      tasks: outcome.taskResults,
    },
  };
}

function handleListScenarios(): MCPToolResult {
  const scenarios = createFaultScenarios();
  addLog('list_scenarios', `Listed ${scenarios.length} fault scenarios`);

  return {
    success: true,
    toolName: 'forkcast.list_scenarios',
    data: { scenarios },
  };
}

function handleSimulateScenario(args: { scenarioId: string }): MCPToolResult {
  if (!args.scenarioId) {
    return { success: false, toolName: 'forkcast.simulate_scenario', error: 'scenarioId is required' };
  }

  const scenarios = createFaultScenarios();
  const fault = scenarios.find(s => s.id === args.scenarioId);
  if (!fault) {
    return { success: false, toolName: 'forkcast.simulate_scenario', error: `Unknown scenario: ${args.scenarioId}` };
  }

  const faultedWorld = applyFault(serverState.world, fault);
  const outcome = simulateWorld(faultedWorld, fault.id);

  serverState.scenarioResults.set(fault.id, { scenario: fault, outcome, repair: null });

  addLog(
    'simulate_scenario',
    `Simulated "${fault.name}": ${outcome.feasible ? 'SURVIVED' : 'FAILED'} — ${outcome.violations.length} violation(s)`,
    outcome.feasible ? 'success' : 'error'
  );

  return {
    success: true,
    toolName: 'forkcast.simulate_scenario',
    data: { scenario: fault, outcome },
  };
}

function handleCompareScenarios(): MCPToolResult {
  if (!serverState.baselineOutcome) {
    // Auto-generate baseline
    serverState.baselineOutcome = simulateWorld(serverState.world, 'baseline');
  }

  const scenarios = createFaultScenarios();
  const results = scenarios.map(fault => {
    const faultedWorld = applyFault(serverState.world, fault);
    const outcome = simulateWorld(faultedWorld, fault.id);
    const repair = outcome.feasible ? null : attemptRepair(serverState.world, fault, outcome);
    serverState.scenarioResults.set(fault.id, { scenario: fault, outcome, repair });
    return { scenario: fault, outcome, repair };
  });

  const comparison: ComparisonResult = {
    baseline: serverState.baselineOutcome!,
    scenarios: results.map(r => ({ scenario: r.scenario, outcome: r.outcome, repair: r.repair ?? undefined })),
    summary: `${results.filter(r => !r.outcome.feasible).length} of ${results.length} scenarios caused failures. ${results.filter(r => r.repair?.feasible).length} repairs found.`,
  };

  addLog('compare_scenarios', comparison.summary, 'info');

  return {
    success: true,
    toolName: 'forkcast.compare_scenarios',
    data: comparison,
  };
}

function handleRepairPlan(args: { scenarioId: string }): MCPToolResult {
  if (!args.scenarioId) {
    return { success: false, toolName: 'forkcast.repair_plan', error: 'scenarioId is required' };
  }

  const cached = serverState.scenarioResults.get(args.scenarioId);
  if (!cached) {
    return { success: false, toolName: 'forkcast.repair_plan', error: 'Run simulate_scenario first' };
  }

  const repair = attemptRepair(serverState.world, cached.scenario, cached.outcome);

  if (repair) {
    serverState.scenarioResults.set(args.scenarioId, { ...cached, repair });
    addLog('repair_plan', `Repair for "${cached.scenario.name}": ${repair.feasible ? 'SUCCESS' : 'NO FEASIBLE REPAIR'}`, repair.feasible ? 'success' : 'warning');
  } else {
    addLog('repair_plan', `No repair possible for "${cached.scenario.name}"`, 'error');
  }

  return {
    success: true,
    toolName: 'forkcast.repair_plan',
    data: { repair, scenario: cached.scenario },
  };
}

function handleCommitPlan(args: { planId: string; approved: boolean }): MCPToolResult {
  if (!args.approved) {
    addLog('commit_plan', 'Plan commit cancelled by user', 'warning');
    return { success: true, toolName: 'forkcast.commit_approved_plan', data: { committed: false, reason: 'Not approved' } };
  }

  if (serverState.committedPlans.has(args.planId)) {
    addLog('commit_plan', `Rejected duplicate commit: ${args.planId}`, 'error');
    return { success: false, toolName: 'forkcast.commit_approved_plan', error: 'Plan already committed (duplicate rejected)' };
  }

  // Validate plan exists
  const result = serverState.scenarioResults.get(args.planId);
  if (!result && args.planId !== 'baseline') {
    return { success: false, toolName: 'forkcast.commit_approved_plan', error: 'Unknown plan ID' };
  }

  // Apply the committed plan (demo-state change only)
  serverState.committedPlans.add(args.planId);
  serverState.world.version += 1;

  addLog('commit_plan', `Committed plan "${args.planId}" — world version now ${serverState.world.version}`, 'success');

  return {
    success: true,
    toolName: 'forkcast.commit_approved_plan',
    data: {
      committed: true,
      planId: args.planId,
      worldVersion: serverState.world.version,
    },
  };
}

// ============================================================
// MCP CLIENT (Browser-side)
// ============================================================

export interface MCPClient {
  connected: boolean;
  tools: MCPToolDefinition[];
  initialize(): Promise<void>;
  listTools(): Promise<MCPToolDefinition[]>;
  callTool(name: string, args?: Record<string, any>): Promise<MCPToolResult>;
  disconnect(): void;
}

export function createMCPClient(): MCPClient {
  const client: MCPClient = {
    connected: false,
    tools: [],

    async initialize(): Promise<void> {
      // Simulate MCP initialization handshake
      await new Promise(resolve => setTimeout(resolve, 300));
      client.connected = true;
      client.tools = [...MCP_TOOLS];
    },

    async listTools(): Promise<MCPToolDefinition[]> {
      if (!client.connected) throw new Error('Client not connected');
      return [...MCP_TOOLS];
    },

    async callTool(name: string, args: Record<string, any> = {}): Promise<MCPToolResult> {
      if (!client.connected) throw new Error('Client not connected');

      // Simulate network latency
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

      switch (name) {
        case 'forkcast.inspect_world':
          return handleInspectWorld();
        case 'forkcast.draft_plan':
          return handleDraftPlan(args);
        case 'forkcast.list_scenarios':
          return handleListScenarios();
        case 'forkcast.simulate_scenario':
          return handleSimulateScenario(args as { scenarioId: string });
        case 'forkcast.compare_scenarios':
          return handleCompareScenarios();
        case 'forkcast.repair_plan':
          return handleRepairPlan(args as { scenarioId: string });
        case 'forkcast.commit_approved_plan':
          return handleCommitPlan(args as { planId: string; approved: boolean });
        default:
          return { success: false, toolName: name, error: `Unknown tool: ${name}` };
      }
    },

    disconnect(): void {
      client.connected = false;
      client.tools = [];
    },
  };

  return client;
}

// ============================================================
// SERVER MANAGEMENT (for demo reset)
// ============================================================

export function resetServerState(): void {
  serverState = createServerState();
}

export function getActivityLog(): ActivityLogEntry[] {
  return [...serverState.activityLog];
}

export function getWorldVersion(): number {
  return serverState.world.version;
}

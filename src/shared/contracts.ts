import type {
  ActionPlan,
  ExecutionRecord,
  ScheduleResult,
  ScenarioSpec,
  SimulationOutcome,
  WorldState
} from "../domain/types.js";
import type { ScenarioComparison } from "../engine/compare.js";
import type { CommitPreview, InventoryChange } from "../engine/commit-preview.js";
import type {
  RepairDiff,
  RepairResult,
  RepairVerification
} from "../engine/repair.js";

export type ActivityType =
  | "PLAN_DRAFTED"
  | "SCENARIO_SIMULATED"
  | "SCENARIOS_COMPARED"
  | "REPAIR_GENERATED"
  | "REPAIR_VERIFIED"
  | "COMMIT_PREVIEWED"
  | "DEMO_COMMITTED"
  | "COMMIT_REJECTED"
  | "DEMO_RESET"
  | "DATA_RECOVERED";

export type ActivitySeverity = "info" | "success" | "warning" | "error";

export interface ActivityEvent {
  id: string;
  atIso: string;
  type: ActivityType;
  title: string;
  detail: string;
  severity: ActivitySeverity;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface ServerInfo {
  name: string;
  version: string;
  protocolVersion: string;
  transport: "streamable-http";
  endpoint: string;
  dataMode: "local-demo";
  llmUsed: false;
}

export interface InspectWorldResult {
  world: WorldState;
  worldRevision: number;
  appliedExecution: ExecutionRecord | null;
  activity: ActivityEvent[];
  server: ServerInfo;
  summary: {
    guestCount: number;
    arrivalMinute: number;
    inventoryLines: number;
    resourceCount: number;
    mealCount: number;
    scenarioCount: number;
  };
}

export interface Interpretation {
  mode: "deterministic-demo";
  llmUsed: false;
  summary: string;
}

export interface BaselinePayload {
  plan: ActionPlan;
  schedule: ScheduleResult;
  world: WorldState;
  worldRevision: number;
  interpretation: Interpretation;
  activityEvent: ActivityEvent;
}

export interface ScenarioListPayload {
  scenarios: ScenarioSpec[];
  worldRevision: number;
}

export interface SnapshotPayload {
  schedule: ScheduleResult;
  outcome: SimulationOutcome;
}

export interface ScenarioAnalysisPayload {
  analysisId: string;
  scenario: ScenarioSpec;
  plan: ActionPlan;
  worldRevision: number;
  baseline: SnapshotPayload;
  faulted: SnapshotPayload;
  comparison: ScenarioComparison;
  activityEvent: ActivityEvent;
}

export interface CompareScenariosPayload {
  planId: string;
  analyses: ScenarioAnalysisPayload[];
  summary: {
    total: number;
    feasible: number;
    failed: number;
    passesWithDegradation: number;
  };
}

export interface RepairPayload {
  analysisId: string;
  result: RepairResult;
  repairedPlan: ActionPlan | null;
  repairedSchedule: ScheduleResult | null;
  verification: RepairVerification | null;
  diff: RepairDiff | null;
  activityEvents: ActivityEvent[];
  proposalReady: boolean;
}

export interface PreviewCommitPayload {
  preview: CommitPreview;
  approvalToken: string;
  expiresAtIso: string;
  note: string;
}

export interface CommitPayload {
  execution: ExecutionRecord;
  world: WorldState;
  worldRevision: number;
  inventoryChanges: InventoryChange[];
  auditEvent: ActivityEvent;
}

export interface ResetPayload {
  world: WorldState;
  worldRevision: number;
  auditEvent: ActivityEvent;
}

export interface ErrorPayload {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

import { randomUUID } from "node:crypto";
import { buildDefaultPlan } from "../domain/plan.js";
import { SCENARIO_SPECS } from "../domain/seed.js";
import { formatTime } from "../domain/time.js";
import { ForkcastDomainError } from "../domain/errors.js";
import type {
  ActionPlan,
  ExecutionRecord,
  ScheduleResult,
  ScenarioSpec,
  SimulationOutcome,
  WorldState
} from "../domain/types.js";
import { evaluateSchedule, schedulePlan } from "../engine/schedule.js";
import {
  getScenarioIds,
  simulateScenario as runScenario
} from "../engine/scenario-runner.js";
import type { ScenarioComparison, Snapshot } from "../engine/compare.js";
import {
  REPAIR_SEARCH_LIMIT,
  repairPlan as calculateRepair,
  type RepairResult
} from "../engine/repair.js";
import {
  applyCommit,
  buildCommitPreview,
  type CommitPreview
} from "../engine/commit-preview.js";
import type {
  ActivityEvent,
  BaselinePayload,
  CommitPayload,
  CompareScenariosPayload,
  ErrorPayload,
  InspectWorldResult,
  PreviewCommitPayload,
  RepairPayload,
  ResetPayload,
  ScenarioAnalysisPayload,
  ScenarioListPayload,
  ServerInfo,
  SnapshotPayload
} from "../shared/contracts.js";
import type { DemoStore } from "./store.js";

interface StoredProposal {
  plan: ActionPlan;
  schedule: ScheduleResult;
  kind: "baseline" | "repair";
  worldRevision: number;
  sourceAnalysisId: string | null;
  createdAtIso: string;
  committed: boolean;
}

interface AnalysisRecord {
  id: string;
  scenario: ScenarioSpec;
  plan: ActionPlan;
  baseline: Snapshot;
  faulted: Snapshot;
  comparison: ScenarioComparison;
  worldRevision: number;
  createdAtIso: string;
}

interface ApprovalRecord {
  token: string;
  planId: string;
  worldRevision: number;
  preview: CommitPreview;
  expiresAtMs: number;
  used: boolean;
}

const APPROVAL_PHRASE = "APPROVE LOCAL DEMO COMMIT";
const APPROVAL_TTL_MS = 5 * 60 * 1000;

function isoNow(): string {
  return new Date().toISOString();
}

function analysisIdFor(scenarioId: string, planId: string): string {
  return "analysis_" + scenarioId + "_" + planId;
}

function scenarioSpec(scenarioId: string): ScenarioSpec {
  const spec = SCENARIO_SPECS.find((entry) => entry.id === scenarioId);
  if (!spec) {
    throw new ForkcastDomainError(
      "UNKNOWN_SCENARIO",
      `Unknown scenario "${scenarioId}". Choose one of: ${getScenarioIds().join(", ")}.`
    );
  }
  return spec;
}

function snapshotPayload(snapshot: Snapshot): SnapshotPayload {
  return {
    schedule: snapshot.schedule,
    outcome: evaluateSchedule(snapshot.world, snapshot.plan, snapshot.schedule) as SimulationOutcome
  };
}

export class ForkcastService {
  private readonly proposals = new Map<string, StoredProposal>();
  private readonly analyses = new Map<string, AnalysisRecord>();
  private readonly approvals = new Map<string, ApprovalRecord>();
  private serverInfo: ServerInfo;

  constructor(
    private readonly store: DemoStore,
    options?: { endpoint?: string }
  ) {
    this.serverInfo = {
      name: "FORKCAST deterministic household simulator",
      version: "0.1.0",
      protocolVersion: "2025-11-25",
      transport: "streamable-http",
      endpoint: options?.endpoint ?? "http://127.0.0.1:4179/mcp",
      dataMode: "local-demo",
      llmUsed: false
    };
  }

  setEndpoint(endpoint: string): void {
    this.serverInfo = { ...this.serverInfo, endpoint };
  }

  getServerInfo(): ServerInfo {
    return { ...this.serverInfo };
  }

  async inspectWorld(): Promise<InspectWorldResult> {
    const world = this.store.getWorldSnapshot();
    return {
      world,
      worldRevision: world.revision,
      appliedExecution: world.appliedExecution,
      activity: this.store
        .getActivitySnapshot()
        .slice(-120)
        .reverse(),
      server: this.getServerInfo(),
      summary: {
        guestCount: world.guestCount,
        arrivalMinute: world.arrivalDeadlineMinute,
        inventoryLines: Object.keys(world.inventory).length,
        resourceCount: Object.keys(world.resources).length,
        mealCount: world.meals.length,
        scenarioCount: SCENARIO_SPECS.length
      }
    };
  }

  listScenarios(): ScenarioListPayload {
    return {
      scenarios: structuredClone(SCENARIO_SPECS),
      worldRevision: this.store.worldRevision
    };
  }

  private resolveProposal(planId: string): StoredProposal {
    const proposal = this.proposals.get(planId);
    if (!proposal) {
      throw new ForkcastDomainError(
        "UNKNOWN_PLAN",
        `No proposal exists for plan id "${planId}". Draft a plan in this server session first.`
      );
    }
    return proposal;
  }

  private assertCurrent(proposal: StoredProposal): WorldState {
    const world = this.store.getWorldSnapshot();
    if (proposal.plan.worldRevision !== world.revision) {
      throw new ForkcastDomainError(
        "STALE_PLAN",
        `Plan revision ${proposal.plan.worldRevision} is stale; demo revision is ${world.revision}. Re-draft the plan.`
      );
    }
    if (world.appliedExecution) {
      throw new ForkcastDomainError(
        "ALREADY_APPLIED",
        "The demo already contains an applied plan. Reset demo data before another approval flow."
      );
    }
    return world;
  }

  async draftPlan(request: string): Promise<BaselinePayload> {
    if (typeof request !== "string" || request.trim().length < 3) {
      throw new ForkcastDomainError(
        "INVALID_ARGUMENT",
        "A request of at least three characters is required."
      );
    }
    if (request.length > 600) {
      throw new ForkcastDomainError("INVALID_ARGUMENT", "Request text must be 600 characters or fewer.");
    }

    const world = this.store.getWorldSnapshot();
    const plan = buildDefaultPlan(world, request.trim());
    const schedule = schedulePlan(world, plan);
    this.proposals.set(plan.id, {
      plan,
      schedule,
      kind: "baseline",
      worldRevision: world.revision,
      sourceAnalysisId: null,
      createdAtIso: isoNow(),
      committed: false
    });

    const activityEvent = await this.store.recordActivity({
      type: "PLAN_DRAFTED",
      title: "Baseline plan calculated",
      detail: `${plan.mealName}: ${schedule.tasks.filter((task) => task.status === "scheduled").length} tasks, projected finish ${formatTime(schedule.completionMinute)}, ${schedule.feasible ? "feasible" : "infeasible"}.`,
      severity: schedule.feasible ? "success" : "warning",
      metadata: {
        planId: plan.id,
        worldRevision: world.revision,
        completionMinute: schedule.completionMinute,
        feasible: schedule.feasible
      }
    });

    return {
      plan,
      schedule,
      world,
      worldRevision: world.revision,
      interpretation: {
        mode: "deterministic-demo",
        llmUsed: false,
        summary:
          "The request is routed to the fixed six-guest dinner seed. All times and constraints below are deterministic scheduler output; no language model generated or approved them."
      },
      activityEvent
    };
  }

  async simulateScenario(scenarioId: string, planId: string): Promise<ScenarioAnalysisPayload> {
    const spec = scenarioSpec(scenarioId);
    const proposal = this.resolveProposal(planId);
    const world = this.assertCurrent(proposal);
    const analysis = runScenario(world, proposal.plan, scenarioId);
    const id = analysisIdFor(scenarioId, planId);
    const createdAtIso = isoNow();

    this.analyses.set(id, {
      id,
      scenario: spec,
      plan: proposal.plan,
      baseline: analysis.baseline,
      faulted: analysis.faulted,
      comparison: analysis.comparison,
      worldRevision: world.revision,
      createdAtIso
    });

    const activityEvent = await this.store.recordActivity({
      type: "SCENARIO_SIMULATED",
      title: "Scenario calculated: " + spec.name,
      detail: analysis.comparison.explanation,
      severity:
        analysis.comparison.verdict === "failed"
          ? "error"
          : analysis.comparison.verdict === "passed-with-degradation"
            ? "warning"
            : "success",
      metadata: {
        analysisId: id,
        scenarioId,
        planId,
        baselineCompletion: analysis.comparison.baselineCompletionMinute,
        faultedCompletion: analysis.comparison.faultedCompletionMinute,
        verdict: analysis.comparison.verdict
      }
    });

    return {
      analysisId: id,
      scenario: spec,
      plan: proposal.plan,
      worldRevision: world.revision,
      baseline: snapshotPayload(analysis.baseline),
      faulted: snapshotPayload(analysis.faulted),
      comparison: analysis.comparison,
      activityEvent
    };
  }

  async compareScenarios(
    planId: string,
    scenarioIds?: string[]
  ): Promise<CompareScenariosPayload> {
    const proposal = this.resolveProposal(planId);
    this.assertCurrent(proposal);
    const ids = scenarioIds && scenarioIds.length > 0 ? scenarioIds : getScenarioIds();
    if (new Set(ids).size !== ids.length) {
      throw new ForkcastDomainError("INVALID_ARGUMENT", "Scenario ids must be unique.");
    }
    for (const id of ids) scenarioSpec(id);
    if (ids.length > SCENARIO_SPECS.length) {
      throw new ForkcastDomainError("INVALID_ARGUMENT", "Too many scenario ids.");
    }

    const analyses: ScenarioAnalysisPayload[] = [];
    for (const id of ids) {
      analyses.push(await this.simulateScenario(id, planId));
    }

    const summary = {
      total: analyses.length,
      feasible: analyses.filter((entry) => entry.faulted.outcome.feasible).length,
      failed: analyses.filter((entry) => !entry.faulted.outcome.feasible).length,
      passesWithDegradation: analyses.filter(
        (entry) => entry.comparison.verdict === "passed-with-degradation"
      ).length
    };

    await this.store.recordActivity({
      type: "SCENARIOS_COMPARED",
      title: "Scenario matrix compared",
      detail: `${summary.total} scenarios: ${summary.feasible} feasible, ${summary.failed} infeasible, ${summary.passesWithDegradation} passed with degradation.`,
      severity: summary.failed > 0 ? "warning" : "success",
      metadata: { planId, total: summary.total, feasible: summary.feasible, failed: summary.failed }
    });

    return { planId, analyses, summary };
  }

  async repairPlan(analysisId: string): Promise<RepairPayload> {
    const analysis = this.analyses.get(analysisId);
    if (!analysis) {
      throw new ForkcastDomainError(
        "NO_ANALYSIS",
        `No simulation analysis exists for id "${analysisId}". Simulate a scenario first.`
      );
    }
    const world = this.store.getWorldSnapshot();
    if (analysis.worldRevision !== world.revision) {
      throw new ForkcastDomainError(
        "STALE_PLAN",
        "The demo revision changed after this analysis. Re-simulate the scenario."
      );
    }

    const result = calculateRepair(analysis.faulted.world, analysis.plan, analysis.faulted.schedule);
    let repairedPlan: ActionPlan | null = null;
    let repairedSchedule: ScheduleResult | null = null;

    if (result.status === "feasible" && result.repairedPlan && result.repairedSchedule) {
      repairedPlan = result.repairedPlan;
      repairedSchedule = result.repairedSchedule;
      this.proposals.set(repairedPlan.id, {
        plan: repairedPlan,
        schedule: repairedSchedule,
        kind: "repair",
        worldRevision: world.revision,
        sourceAnalysisId: analysisId,
        createdAtIso: isoNow(),
        committed: false
      });
    }

    const generatedEvent = await this.store.recordActivity({
      type: "REPAIR_GENERATED",
      title:
        result.status === "feasible"
          ? "Repair candidate calculated"
          : result.status === "not-needed"
            ? "No repair needed"
            : "Repair search finished without a feasible candidate",
      detail: result.explanation,
      severity:
        result.status === "feasible" || result.status === "not-needed" ? "info" : "warning",
      metadata: {
        analysisId,
        sourcePlanId: result.sourcePlanId,
        repairPlanId: result.repairPlanId,
        attemptCount: result.search.evaluated,
        searchLimit: REPAIR_SEARCH_LIMIT
      }
    });

    const activityEvents: ActivityEvent[] = [generatedEvent];
    if (result.verification?.verified && repairedPlan) {
      activityEvents.push(
        await this.store.recordActivity({
          type: "REPAIR_VERIFIED",
          title: "Repair independently verified",
          detail: result.explanation,
          severity: "success",
          metadata: {
            repairPlanId: repairedPlan.id,
            completionMinute: result.verification.completionMinute,
            method: result.verification.method
          }
        })
      );
    }

    return {
      analysisId,
      result,
      repairedPlan,
      repairedSchedule,
      verification: result.verification,
      diff: result.diff,
      activityEvents,
      proposalReady: Boolean(repairedPlan)
    };
  }

  private pruneApprovals(): void {
    const now = Date.now();
    for (const [token, approval] of this.approvals) {
      if (approval.used || approval.expiresAtMs < now) this.approvals.delete(token);
    }
  }

  async previewCommit(planId: string): Promise<PreviewCommitPayload> {
    const proposal = this.resolveProposal(planId);
    const world = this.assertCurrent(proposal);
    const schedule = schedulePlan(world, proposal.plan);
    if (!schedule.feasible) {
      throw new ForkcastDomainError(
        "PLAN_NOT_FEASIBLE",
        "The current scheduler rejects this plan. It cannot be previewed for commit.",
        { violations: schedule.violations.filter((entry) => entry.severity === "error") }
      );
    }

    this.pruneApprovals();
    const preview = buildCommitPreview(world, proposal.plan, schedule, isoNow());
    const token = "approval_" + randomUUID();
    const expiresAtMs = Date.now() + APPROVAL_TTL_MS;
    this.approvals.set(token, {
      token,
      planId,
      worldRevision: world.revision,
      preview,
      expiresAtMs,
      used: false
    });

    await this.store.recordActivity({
      type: "COMMIT_PREVIEWED",
      title: "Commit preview generated",
      detail: preview.summary,
      severity: "info",
      metadata: {
        planId,
        worldRevision: world.revision,
        inventoryChangeCount: preview.inventoryChanges.length,
        approvalExpiresAtIso: new Date(expiresAtMs).toISOString()
      }
    });

    return {
      preview,
      approvalToken: token,
      expiresAtIso: new Date(expiresAtMs).toISOString(),
      note:
        "The approval token is single-use and expires in five minutes. Commit also requires the exact approval phrase. No demo data has changed yet."
    };
  }

  async commitApprovedPlan(input: {
    planId: string;
    approvalToken: string;
    approvalText: string;
  }): Promise<CommitPayload> {
    try {
      if (input.approvalText !== APPROVAL_PHRASE) {
        throw new ForkcastDomainError(
          "APPROVAL_REQUIRED",
          `Explicit approval is required. Send approvalText "${APPROVAL_PHRASE}".`
        );
      }
      const approval = this.approvals.get(input.approvalToken);
      if (!approval) {
        throw new ForkcastDomainError(
          "INVALID_APPROVAL",
          "The approval token is unknown or has already been removed."
        );
      }
      if (approval.used) {
        throw new ForkcastDomainError(
          "ALREADY_COMMITTED",
          "This approval token has already been used. Repeated commits are rejected."
        );
      }
      if (approval.planId !== input.planId) {
        throw new ForkcastDomainError(
          "INVALID_APPROVAL",
          "The approval token belongs to a different plan."
        );
      }
      if (approval.expiresAtMs < Date.now()) {
        throw new ForkcastDomainError(
          "APPROVAL_EXPIRED",
          "The approval token expired. Generate a new commit preview."
        );
      }

      const world = this.store.getWorldSnapshot();
      if (approval.worldRevision !== world.revision) {
        throw new ForkcastDomainError(
          "STALE_PLAN",
          "The demo revision changed after preview. The commit was rejected."
        );
      }
      const proposal = this.resolveProposal(input.planId);
      if (proposal.committed) {
        throw new ForkcastDomainError(
          "ALREADY_COMMITTED",
          "This proposal is already committed."
        );
      }
      if (world.appliedExecution) {
        throw new ForkcastDomainError(
          "ALREADY_APPLIED",
          "The demo already has an applied execution. Reset demo data before another commit."
        );
      }

      // Consume the token synchronously before the first await. Two concurrent
      // calls cannot both pass the used check.
      approval.used = true;
      const appliedAtIso = isoNow();
      const nextWorld = applyCommit(world, approval.preview, appliedAtIso);
      const execution = nextWorld.appliedExecution;
      if (!execution) {
        throw new ForkcastDomainError("PERSISTENCE_ERROR", "Applied execution record was not created.");
      }

      await this.store.replaceWorld(nextWorld, world.revision);
      proposal.committed = true;

      let auditEvent: ActivityEvent;
      try {
        auditEvent = await this.store.recordActivity({
          type: "DEMO_COMMITTED",
          title: "Approved plan applied to local demo data",
          detail: `${execution.mealName}: ${execution.taskCount} tasks recorded, demo revision ${nextWorld.revision}. ${approval.preview.inventoryChanges.length} inventory line(s) changed. No real-world action occurred.`,
          severity: "success",
          metadata: {
            planId: execution.planId,
            worldRevision: nextWorld.revision,
            completionMinute: execution.completionMinute,
            inventoryChangeCount: approval.preview.inventoryChanges.length
          }
        });
      } catch (auditError) {
        throw new ForkcastDomainError(
          "PERSISTENCE_ERROR",
          "The plan was applied to demo-state.json, but writing the audit event failed. Do not re-submit; inspect the current world revision first.",
          {
            applied: true,
            worldRevision: nextWorld.revision,
            auditError: auditError instanceof Error ? auditError.message : String(auditError)
          }
        );
      }

      return {
        execution,
        world: nextWorld,
        worldRevision: nextWorld.revision,
        inventoryChanges: approval.preview.inventoryChanges,
        auditEvent
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.store
        .recordActivity({
          type: "COMMIT_REJECTED",
          title: "Commit rejected",
          detail: message,
          severity: "error",
          metadata: { planId: input.planId }
        })
        .catch(() => undefined);
      throw error;
    }
  }

  async resetDemo(confirmation: string): Promise<ResetPayload> {
    if (confirmation !== "RESET DEMO DATA") {
      throw new ForkcastDomainError(
        "RESET_CONFIRMATION_REQUIRED",
        'Reset requires the exact confirmation "RESET DEMO DATA".'
      );
    }
    // Advance the revision so any in-flight preview or approval token becomes
    // stale even though the seed content is restored.
    const world = await this.store.resetWorld(this.store.worldRevision + 1);
    this.proposals.clear();
    this.analyses.clear();
    this.approvals.clear();
    const auditEvent = await this.store.recordActivity({
      type: "DEMO_RESET",
      title: "Demo data reset to seed",
      detail:
        "The dedicated local demo dataset was restored to the deterministic six-guest seed. Audit history was preserved.",
      severity: "warning",
      metadata: { worldRevision: world.revision, seedId: world.seedId }
    });
    return { world, worldRevision: world.revision, auditEvent };
  }

  toErrorPayload(error: unknown): ErrorPayload {
    if (error instanceof ForkcastDomainError) {
      return {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {})
        }
      };
    }
    return {
      error: {
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

export { APPROVAL_PHRASE };
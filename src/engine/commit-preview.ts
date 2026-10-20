import { ForkcastDomainError } from "../domain/errors.js";
import type {
  ActionPlan,
  ExecutionRecord,
  ScheduleResult,
  WorldState
} from "../domain/types.js";

export interface InventoryChange {
  ingredientId: string;
  name: string;
  unit: string;
  before: number;
  consumed: number;
  after: number;
}

export interface CommitPreview {
  planId: string;
  planOrigin: "baseline" | "repair";
  planKind: "baseline" | "repair";
  mealId: string;
  mealName: string;
  request: string;
  worldRevision: number;
  completionMinute: number;
  deadlineMinute: number;
  slackMinutes: number;
  taskCount: number;
  scheduledTaskNames: string[];
  inventoryChanges: InventoryChange[];
  revisionBefore: number;
  revisionAfter: number;
  execution: ExecutionRecord;
  summary: string;
}

export function buildExecutionRecord(
  world: WorldState,
  plan: ActionPlan,
  schedule: ScheduleResult,
  appliedAtIso: string
): ExecutionRecord {
  const consumed = new Map<string, number>();
  for (const task of plan.tasks) {
    for (const requirement of task.ingredients) {
      consumed.set(
        requirement.ingredientId,
        (consumed.get(requirement.ingredientId) ?? 0) + requirement.quantity
      );
    }
  }

  const ingredientConsumption = [...consumed.entries()]
    .map(([ingredientId, quantity]) => {
      const ingredient = world.inventory[ingredientId];
      return {
        ingredientId,
        name: ingredient?.name ?? ingredientId,
        quantity: Math.round(quantity * 1000) / 1000,
        unit: ingredient?.unit ?? "unit"
      };
    })
    .sort((a, b) => a.ingredientId.localeCompare(b.ingredientId));

  return {
    planId: plan.id,
    mealId: plan.mealId,
    mealName: plan.mealName,
    appliedAtIso,
    completionMinute: schedule.completionMinute ?? 0,
    taskCount: plan.tasks.length,
    ingredientConsumption,
    note:
      "Applied to the local simulated household dataset only. No purchase, message, booking or device action was performed."
  };
}

export function buildCommitPreview(
  world: WorldState,
  plan: ActionPlan,
  schedule: ScheduleResult,
  appliedAtIso: string
): CommitPreview {
  if (plan.worldRevision !== world.revision) {
    throw new ForkcastDomainError(
      "STALE_PLAN",
      `This plan was calculated for world revision ${plan.worldRevision}; the demo is now at revision ${world.revision}. Re-draft the plan.`,
      { planRevision: plan.worldRevision, worldRevision: world.revision }
    );
  }
  if (world.appliedExecution) {
    throw new ForkcastDomainError(
      "ALREADY_APPLIED",
      "The demo dataset already contains an applied execution. Reset the demo before applying another plan.",
      { appliedPlanId: world.appliedExecution.planId }
    );
  }
  if (!schedule.feasible || schedule.completionMinute === null) {
    throw new ForkcastDomainError(
      "PLAN_NOT_FEASIBLE",
      "Only a scheduler-verified feasible plan can be previewed for commit.",
      { violations: schedule.violations.filter((entry) => entry.severity === "error") }
    );
  }

  const consumed = new Map<string, number>();
  for (const task of plan.tasks) {
    for (const requirement of task.ingredients) {
      const current = consumed.get(requirement.ingredientId) ?? 0;
      consumed.set(requirement.ingredientId, current + requirement.quantity);
    }
  }

  const inventoryChanges: InventoryChange[] = [];
  for (const [ingredientId, quantity] of [...consumed.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    const ingredient = world.inventory[ingredientId];
    if (!ingredient) {
      throw new ForkcastDomainError(
        "INSUFFICIENT_INVENTORY",
        `Plan requires missing ingredient "${ingredientId}".`,
        { ingredientId }
      );
    }
    if (quantity > ingredient.quantity + 1e-9) {
      throw new ForkcastDomainError(
        "INSUFFICIENT_INVENTORY",
        `Plan requires ${quantity} ${ingredient.unit} of ${ingredient.name}, but only ${ingredient.quantity} is available.`,
        { ingredientId }
      );
    }
    inventoryChanges.push({
      ingredientId,
      name: ingredient.name,
      unit: ingredient.unit,
      before: ingredient.quantity,
      consumed: Math.round(quantity * 1000) / 1000,
      after: Math.round((ingredient.quantity - quantity) * 1000) / 1000
    });
  }

  const execution = buildExecutionRecord(world, plan, schedule, appliedAtIso);
  const scheduledNames = schedule.tasks
    .filter((task) => task.status === "scheduled")
    .sort(
      (a, b) =>
        (a.startMinute ?? 0) - (b.startMinute ?? 0) || a.taskId.localeCompare(b.taskId)
    )
    .map((task) => task.name);

  return {
    planId: plan.id,
    planOrigin: plan.origin,
    planKind: plan.origin,
    mealId: plan.mealId,
    mealName: plan.mealName,
    request: plan.request,
    worldRevision: world.revision,
    completionMinute: schedule.completionMinute,
    deadlineMinute: schedule.deadlineMinute,
    slackMinutes: schedule.slackMinutes ?? 0,
    taskCount: scheduledNames.length,
    scheduledTaskNames: scheduledNames,
    inventoryChanges,
    revisionBefore: world.revision,
    revisionAfter: world.revision + 1,
    execution,
    summary:
      `Approve ${plan.mealName} (${scheduledNames.length} scheduled tasks). The local demo inventory will be reduced as listed, the applied execution record will be written, and the demo revision will move from ${world.revision} to ${world.revision + 1}. No real-world action is performed.`
  };
}

export function applyCommit(
  world: WorldState,
  preview: CommitPreview,
  appliedAtIso: string
): WorldState {
  if (world.revision !== preview.worldRevision) {
    throw new ForkcastDomainError(
      "STALE_PLAN",
      "The demo revision changed between preview and commit. The commit was rejected."
    );
  }
  if (world.appliedExecution) {
    throw new ForkcastDomainError(
      "ALREADY_APPLIED",
      "The demo already has an applied execution. The commit was rejected."
    );
  }

  const next = structuredClone(world);
  for (const change of preview.inventoryChanges) {
    const ingredient = next.inventory[change.ingredientId];
    if (!ingredient) {
      throw new ForkcastDomainError(
        "INSUFFICIENT_INVENTORY",
        `Ingredient "${change.ingredientId}" disappeared before commit.`
      );
    }
    if (ingredient.quantity + 1e-9 < change.consumed) {
      throw new ForkcastDomainError(
        "INSUFFICIENT_INVENTORY",
        `Ingredient "${change.ingredientId}" no longer has enough quantity for this commit.`
      );
    }
    ingredient.quantity = Math.round((ingredient.quantity - change.consumed) * 1000) / 1000;
  }

  next.revision = preview.revisionAfter;
  next.appliedExecution = {
    ...preview.execution,
    appliedAtIso
  };
  return next;
}

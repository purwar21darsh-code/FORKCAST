import { buildPlan, TASK_ORDER_PROFILES, type TaskOrderProfile } from "../domain/plan.js";
import { formatTime } from "../domain/time.js";
import type { ActionPlan, ScheduleResult, WorldState } from "../domain/types.js";
import { schedulePlan } from "./schedule.js";

export const REPAIR_SEARCH_LIMIT = 24;

export interface RepairDiff {
  originalMealId: string;
  originalMealName: string;
  repairedMealId: string;
  repairedMealName: string;
  mealChanged: boolean;
  originalCompletionMinute: number | null;
  repairedCompletionMinute: number | null;
  completionDeltaMinutes: number | null;
  addedTasks: { id: string; name: string }[];
  removedTasks: { id: string; name: string }[];
  reorderedTaskIds: string[];
  resourceAssignmentsChanged: { taskId: string; from: string[]; to: string[] }[];
  ingredientIdsAdded: string[];
  ingredientIdsRemoved: string[];
  optionalOmissions: string[];
}

export interface RepairVerification {
  verified: boolean;
  method: string;
  feasible: boolean;
  completionMinute: number | null;
  violations: string[];
}

export interface RepairAttemptSummary {
  planId: string;
  mealId: string;
  profile: TaskOrderProfile;
  feasible: boolean;
  completionMinute: number | null;
  blockingViolation: string | null;
}

export interface RepairResult {
  status:
    | "feasible"
    | "not-needed"
    | "no-feasible-repair"
    | "search-limit"
    | "simulation-error";
  sourcePlanId: string;
  repairPlanId: string | null;
  repairedPlan: ActionPlan | null;
  repairedSchedule: ScheduleResult | null;
  verification: RepairVerification | null;
  diff: RepairDiff | null;
  explanation: string;
  tradeoffs: string[];
  constraintsRelaxed: false;
  search: {
    limit: number;
    evaluated: number;
    attempts: RepairAttemptSummary[];
  };
}

function ingredientIds(plan: ActionPlan): Set<string> {
  const ids = new Set<string>();
  for (const task of plan.tasks) {
    for (const requirement of task.ingredients) ids.add(requirement.ingredientId);
  }
  return ids;
}

function taskOrder(plan: ActionPlan): string[] {
  return plan.tasks.map((task) => task.id);
}

function reorderedTaskIds(original: ActionPlan, repaired: ActionPlan): string[] {
  const common = taskOrder(original).filter((id) => repaired.tasks.some((task) => task.id === id));
  const repairedCommon = taskOrder(repaired).filter((id) => common.includes(id));
  const changed: string[] = [];
  for (let index = 0; index < common.length; index += 1) {
    if (common[index] !== repairedCommon[index]) {
      const id = common[index];
      if (id) changed.push(id);
    }
  }
  return changed;
}

export function buildRepairDiff(
  originalPlan: ActionPlan,
  originalSchedule: ScheduleResult,
  repairedPlan: ActionPlan,
  repairedSchedule: ScheduleResult
): RepairDiff {
  const originalTasks = new Map(originalPlan.tasks.map((task) => [task.id, task]));
  const repairedTasks = new Map(repairedPlan.tasks.map((task) => [task.id, task]));
  const addedTasks = [...repairedTasks.values()]
    .filter((task) => !originalTasks.has(task.id))
    .map((task) => ({ id: task.id, name: task.name }));
  const removedTasks = [...originalTasks.values()]
    .filter((task) => !repairedTasks.has(task.id))
    .map((task) => ({ id: task.id, name: task.name }));

  const originalResources = new Map(
    originalSchedule.tasks.map((task) => [task.taskId, task.resourcesAssigned])
  );
  const resourceAssignmentsChanged = repairedSchedule.tasks
    .filter((task) => {
      const before = originalResources.get(task.taskId) ?? [];
      return (
        before.length !== task.resourcesAssigned.length ||
        before.some((resource, index) => resource !== task.resourcesAssigned[index])
      );
    })
    .map((task) => ({
      taskId: task.taskId,
      from: originalResources.get(task.taskId) ?? [],
      to: task.resourcesAssigned
    }));

  const originalIngredients = ingredientIds(originalPlan);
  const repairedIngredients = ingredientIds(repairedPlan);
  const ingredientIdsAdded = [...repairedIngredients]
    .filter((id) => !originalIngredients.has(id))
    .sort();
  const ingredientIdsRemoved = [...originalIngredients]
    .filter((id) => !repairedIngredients.has(id))
    .sort();
  const optionalOmissions = repairedSchedule.tasks
    .filter((task) => task.optional && task.status !== "scheduled")
    .map((task) => task.taskId);

  return {
    originalMealId: originalPlan.mealId,
    originalMealName: originalPlan.mealName,
    repairedMealId: repairedPlan.mealId,
    repairedMealName: repairedPlan.mealName,
    mealChanged: originalPlan.mealId !== repairedPlan.mealId,
    originalCompletionMinute: originalSchedule.completionMinute,
    repairedCompletionMinute: repairedSchedule.completionMinute,
    completionDeltaMinutes:
      originalSchedule.completionMinute !== null && repairedSchedule.completionMinute !== null
        ? repairedSchedule.completionMinute - originalSchedule.completionMinute
        : null,
    addedTasks,
    removedTasks,
    reorderedTaskIds: reorderedTaskIds(originalPlan, repairedPlan),
    resourceAssignmentsChanged,
    ingredientIdsAdded,
    ingredientIdsRemoved,
    optionalOmissions
  };
}

function scoreCandidate(
  diff: RepairDiff,
  schedule: ScheduleResult
): number {
  if (schedule.completionMinute === null) return Number.POSITIVE_INFINITY;
  const changedTasks = diff.addedTasks.length + diff.removedTasks.length + diff.reorderedTaskIds.length;
  const substitutions = diff.mealChanged ? 1 : 0;
  const resources = diff.resourceAssignmentsChanged.length;
  const omissions = diff.optionalOmissions.length;
  return (
    schedule.completionMinute +
    changedTasks * 3 +
    substitutions * 20 +
    resources * 4 +
    omissions * 2
  );
}

interface Candidate {
  plan: ActionPlan;
  schedule: ScheduleResult;
  diff: RepairDiff;
  profile: TaskOrderProfile;
  score: number;
}

function verifyCandidate(
  world: WorldState,
  candidate: Candidate
): RepairVerification {
  const rerun = schedulePlan(world, candidate.plan);
  const same =
    rerun.feasible === candidate.schedule.feasible &&
    rerun.completionMinute === candidate.schedule.completionMinute &&
    rerun.tasks.every((task, index) => {
      const original = candidate.schedule.tasks[index];
      return (
        original !== undefined &&
        original.taskId === task.taskId &&
        original.status === task.status &&
        original.startMinute === task.startMinute &&
        original.endMinute === task.endMinute
      );
    });
  const verified = same && rerun.feasible;
  return {
    verified,
    method:
      "Independent deterministic re-schedule of the repaired plan against the same isolated faulted world.",
    feasible: rerun.feasible,
    completionMinute: rerun.completionMinute,
    violations: rerun.violations
      .filter((entry) => entry.severity === "error")
      .map((entry) => entry.message)
  };
}

/**
 * Search a bounded set of meal alternatives and deterministic task-order
 * profiles. A repair is only returned as feasible after a fresh scheduler
 * verification pass.
 */
export function repairPlan(
  faultedWorld: WorldState,
  originalPlan: ActionPlan,
  failedSchedule: ScheduleResult
): RepairResult {
  if (failedSchedule.feasible) {
    return {
      status: "not-needed",
      sourcePlanId: originalPlan.id,
      repairPlanId: null,
      repairedPlan: null,
      repairedSchedule: null,
      verification: {
        verified: true,
        method: "The faulted schedule was already feasible; no repair was generated.",
        feasible: true,
        completionMinute: failedSchedule.completionMinute,
        violations: []
      },
      diff: null,
      explanation:
        "The selected fault did not break the hard constraints, so FORKCAST did not invent a repair.",
      tradeoffs: [],
      constraintsRelaxed: false,
      search: { limit: REPAIR_SEARCH_LIMIT, evaluated: 0, attempts: [] }
    };
  }

  const attempts: RepairAttemptSummary[] = [];
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  let evaluationError: string | null = null;

  try {
    outer: for (const meal of faultedWorld.meals) {
      for (const profile of TASK_ORDER_PROFILES) {
        if (attempts.length >= REPAIR_SEARCH_LIMIT) break outer;
        const plan = buildPlan(faultedWorld, meal.id, originalPlan.request, "repair", profile);
        if (seen.has(plan.id)) continue;
        seen.add(plan.id);
        const schedule = schedulePlan(faultedWorld, plan);
        const diff = buildRepairDiff(originalPlan, failedSchedule, plan, schedule);
        attempts.push({
          planId: plan.id,
          mealId: meal.id,
          profile,
          feasible: schedule.feasible,
          completionMinute: schedule.completionMinute,
          blockingViolation:
            schedule.violations.find((entry) => entry.severity === "error")?.message ?? null
        });
        if (schedule.feasible) {
          candidates.push({
            plan,
            schedule,
            diff,
            profile,
            score: scoreCandidate(diff, schedule)
          });
        }
      }
    }
  } catch (error) {
    evaluationError = error instanceof Error ? error.message : String(error);
  }

  if (evaluationError) {
    return {
      status: "simulation-error",
      sourcePlanId: originalPlan.id,
      repairPlanId: null,
      repairedPlan: null,
      repairedSchedule: null,
      verification: null,
      diff: null,
      explanation: "Repair search failed: " + evaluationError,
      tradeoffs: [],
      constraintsRelaxed: false,
      search: { limit: REPAIR_SEARCH_LIMIT, evaluated: attempts.length, attempts }
    };
  }

  candidates.sort(
    (a, b) =>
      a.score - b.score ||
      (a.schedule.completionMinute ?? Number.MAX_SAFE_INTEGER) -
        (b.schedule.completionMinute ?? Number.MAX_SAFE_INTEGER) ||
      a.plan.id.localeCompare(b.plan.id)
  );
  const chosen = candidates[0];

  if (!chosen) {
    const limitReached =
      attempts.length >= REPAIR_SEARCH_LIMIT &&
      faultedWorld.meals.length * TASK_ORDER_PROFILES.length > REPAIR_SEARCH_LIMIT;
    return {
      status: limitReached ? "search-limit" : "no-feasible-repair",
      sourcePlanId: originalPlan.id,
      repairPlanId: null,
      repairedPlan: null,
      repairedSchedule: null,
      verification: null,
      diff: null,
      explanation: limitReached
        ? `The bounded repair search reached its limit of ${REPAIR_SEARCH_LIMIT} candidates without finding a verified feasible plan.`
        : `No defined meal or task-order alternative satisfies the hard constraints in this faulted world. ${attempts.length} candidates were calculated.`,
      tradeoffs: [
        "FORKCAST did not relax the guest deadline or any dependency.",
        "No alternative outside the seeded world model was invented."
      ],
      constraintsRelaxed: false,
      search: { limit: REPAIR_SEARCH_LIMIT, evaluated: attempts.length, attempts }
    };
  }

  const verification = verifyCandidate(faultedWorld, chosen);
  if (!verification.verified) {
    return {
      status: "simulation-error",
      sourcePlanId: originalPlan.id,
      repairPlanId: null,
      repairedPlan: null,
      repairedSchedule: null,
      verification,
      diff: null,
      explanation:
        "A candidate appeared feasible, but independent re-scheduling did not reproduce the result. FORKCAST refuses to claim a repair.",
      tradeoffs: [],
      constraintsRelaxed: false,
      search: { limit: REPAIR_SEARCH_LIMIT, evaluated: attempts.length, attempts }
    };
  }

  const tradeoffs: string[] = [];
  if (chosen.diff.mealChanged) {
    tradeoffs.push(
      `Meal changed from ${chosen.diff.originalMealName} to ${chosen.diff.repairedMealName}.`
    );
  }
  if (chosen.diff.addedTasks.length > 0 || chosen.diff.removedTasks.length > 0) {
    tradeoffs.push(
      `${chosen.diff.addedTasks.length} task(s) added and ${chosen.diff.removedTasks.length} task(s) removed.`
    );
  }
  if (chosen.diff.optionalOmissions.length > 0) {
    tradeoffs.push(
      `Optional tasks omitted: ${chosen.diff.optionalOmissions.join(", ")}.`
    );
  }
  if (tradeoffs.length === 0) tradeoffs.push("The repaired plan keeps the same task set.");

  const completionText =
    chosen.schedule.completionMinute === null
      ? "unknown"
      : formatTime(chosen.schedule.completionMinute);
  const explanation = chosen.diff.mealChanged
    ? `Verified repair: substitute ${chosen.diff.repairedMealName} and reorder with the ${chosen.profile} profile. The recalculated plan finishes at ${completionText}, ${chosen.schedule.slackMinutes ?? "?"} minutes before the guest deadline.`
    : `Verified repair: keep ${chosen.diff.repairedMealName} but use the ${chosen.profile} task order. The recalculated plan finishes at ${completionText}, ${chosen.schedule.slackMinutes ?? "?"} minutes before the guest deadline.`;

  return {
    status: "feasible",
    sourcePlanId: originalPlan.id,
    repairPlanId: chosen.plan.id,
    repairedPlan: chosen.plan,
    repairedSchedule: chosen.schedule,
    verification,
    diff: chosen.diff,
    explanation,
    tradeoffs,
    constraintsRelaxed: false,
    search: { limit: REPAIR_SEARCH_LIMIT, evaluated: attempts.length, attempts }
  };
}
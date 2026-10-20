import type { ActionPlan, ScheduleResult, WorldState } from "../domain/types.js";

export interface Snapshot {
  world: WorldState;
  plan: ActionPlan;
  schedule: ScheduleResult;
}

export interface TaskDelta {
  taskId: string;
  name: string;
  baselineStatus: string;
  faultedStatus: string;
  baselineStart: number | null;
  faultedStart: number | null;
  baselineEnd: number | null;
  faultedEnd: number | null;
  startDeltaMinutes: number | null;
}

export interface ScenarioComparison {
  verdict: "passed" | "passed-with-degradation" | "failed" | "improved";
  baselineCompletionMinute: number | null;
  faultedCompletionMinute: number | null;
  completionDeltaMinutes: number | null;
  baselineSlackMinutes: number | null;
  faultedSlackMinutes: number | null;
  baselineDeadlineMet: boolean;
  faultedDeadlineMet: boolean;
  newlyViolatedConstraints: string[];
  newWarnings: string[];
  resolvedConstraints: string[];
  affectedTasks: TaskDelta[];
  missingIngredientIds: string[];
  unavailableResourceIds: string[];
  skippedOptionalTaskIds: string[];
  explanation: string;
}

function violationKey(code: string, taskId: string | undefined, message: string): string {
  return [code, taskId ?? "", message].join("|");
}

export function compareSchedules(
  baseline: Snapshot,
  faulted: Snapshot
): ScenarioComparison {
  const baselineKeys = new Set(
    baseline.schedule.violations.map((entry) => violationKey(entry.code, entry.taskId, entry.message))
  );
  const faultedKeys = new Set(
    faulted.schedule.violations.map((entry) => violationKey(entry.code, entry.taskId, entry.message))
  );

  const newlyViolated = faulted.schedule.violations.filter(
    (entry) =>
      entry.severity === "error" &&
      !baselineKeys.has(violationKey(entry.code, entry.taskId, entry.message))
  );
  const newWarnings = faulted.schedule.violations.filter(
    (entry) =>
      entry.severity === "warning" &&
      !baselineKeys.has(violationKey(entry.code, entry.taskId, entry.message))
  );
  const resolved = baseline.schedule.violations.filter(
    (entry) =>
      entry.severity === "error" &&
      !faultedKeys.has(violationKey(entry.code, entry.taskId, entry.message))
  );

  const baselineTasks = new Map(baseline.schedule.tasks.map((task) => [task.taskId, task]));
  const affectedTasks: TaskDelta[] = [];
  for (const faultedTask of faulted.schedule.tasks) {
    const baselineTask = baselineTasks.get(faultedTask.taskId);
    if (!baselineTask) continue;
    const statusChanged = baselineTask.status !== faultedTask.status;
    const startChanged = baselineTask.startMinute !== faultedTask.startMinute;
    const endChanged = baselineTask.endMinute !== faultedTask.endMinute;
    if (!statusChanged && !startChanged && !endChanged) continue;
    affectedTasks.push({
      taskId: faultedTask.taskId,
      name: faultedTask.name,
      baselineStatus: baselineTask.status,
      faultedStatus: faultedTask.status,
      baselineStart: baselineTask.startMinute,
      faultedStart: faultedTask.startMinute,
      baselineEnd: baselineTask.endMinute,
      faultedEnd: faultedTask.endMinute,
      startDeltaMinutes:
        baselineTask.startMinute !== null && faultedTask.startMinute !== null
          ? faultedTask.startMinute - baselineTask.startMinute
          : null
    });
  }

  const missingIngredientIds = [
    ...new Set(
      faulted.schedule.violations
        .filter(
          (entry) =>
            entry.ingredientId &&
            (entry.code === "MISSING_INGREDIENT" || entry.code === "INSUFFICIENT_INGREDIENT")
        )
        .map((entry) => entry.ingredientId as string)
    )
  ];
  const unavailableResourceIds = [
    ...new Set(
      faulted.schedule.violations
        .filter((entry) => entry.resourceId && entry.code === "RESOURCE_UNAVAILABLE")
        .map((entry) => entry.resourceId as string)
    )
  ];
  const skippedOptionalTaskIds = faulted.schedule.tasks
    .filter((task) => task.optional && task.status !== "scheduled")
    .map((task) => task.taskId);

  const baselineDeadlineMet =
    baseline.schedule.completionMinute !== null &&
    baseline.schedule.completionMinute <= baseline.world.arrivalDeadlineMinute;
  const faultedDeadlineMet =
    faulted.schedule.completionMinute !== null &&
    faulted.schedule.completionMinute <= faulted.world.arrivalDeadlineMinute;

  let verdict: ScenarioComparison["verdict"];
  if (faulted.schedule.feasible) {
    if (newWarnings.length > 0 || skippedOptionalTaskIds.length > 0) {
      verdict = "passed-with-degradation";
    } else {
      verdict = "passed";
    }
  } else {
    verdict = "failed";
  }

  const completionDelta =
    baseline.schedule.completionMinute !== null && faulted.schedule.completionMinute !== null
      ? faulted.schedule.completionMinute - baseline.schedule.completionMinute
      : null;

  const explanation = faulted.schedule.feasible
    ? newWarnings.length > 0
      ? `The plan still meets the hard constraints, but ${newWarnings.length} warning${newWarnings.length === 1 ? "" : "s"} and ${skippedOptionalTaskIds.length} optional omission${skippedOptionalTaskIds.length === 1 ? "" : "s"} were calculated.`
      : "The same plan remains feasible after the fault. No hard constraint changed."
    : `The fault breaks ${newlyViolated.length} hard constraint${newlyViolated.length === 1 ? "" : "s"}. ${completionDelta === null ? "Projected completion is unknown." : `Projected completion moved by ${completionDelta >= 0 ? "+" : ""}${completionDelta} minutes.`}`;

  return {
    verdict,
    baselineCompletionMinute: baseline.schedule.completionMinute,
    faultedCompletionMinute: faulted.schedule.completionMinute,
    completionDeltaMinutes: completionDelta,
    baselineSlackMinutes: baseline.schedule.slackMinutes,
    faultedSlackMinutes: faulted.schedule.slackMinutes,
    baselineDeadlineMet,
    faultedDeadlineMet,
    newlyViolatedConstraints: newlyViolated.map((entry) => entry.message),
    newWarnings: newWarnings.map((entry) => entry.message),
    resolvedConstraints: resolved.map((entry) => entry.message),
    affectedTasks,
    missingIngredientIds,
    unavailableResourceIds,
    skippedOptionalTaskIds,
    explanation
  };
}

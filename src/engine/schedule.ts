import { formatTime } from "../domain/time.js";
import type {
  ActionPlan,
  ConstraintViolation,
  Minutes,
  PlanTask,
  ResourceInterval,
  ScheduleEvidence,
  ScheduleResult,
  ScheduledTask,
  WorldState
} from "../domain/types.js";

interface ScheduledInternal {
  task: PlanTask;
  orderIndex: number;
  status: ScheduledTask["status"];
  startMinute: Minutes | null;
  endMinute: Minutes | null;
  resourcesAssigned: string[];
  reason: string | null;
}

interface CalendarInterval {
  startMinute: Minutes;
  endMinute: Minutes;
}

function violation(
  code: ConstraintViolation["code"],
  severity: ConstraintViolation["severity"],
  message: string,
  extra: Partial<Pick<ConstraintViolation, "taskId" | "resourceId" | "ingredientId">> = {}
): ConstraintViolation {
  return { code, severity, message, ...extra };
}

function evidence(): ScheduleEvidence {
  return {
    algorithm: "deterministic-resource-aware-greedy-v1",
    taskOrderRule:
      "Ready tasks are chosen by earliest feasible start; ties use the task's position in the plan.",
    tieBreakRule: "earliest start, then plan order, then task id",
    resourceRule:
      "A task starts only when every required resource has a free capacity slot; unavailable primaries fall back to declared alternatives.",
    candidateEvaluations: 0,
    resourceWaitCount: 0,
    ingredientWaitCount: 0,
    selectedTaskOrder: [],
    notes: [
      "No wall clock is read. The seeded day and all durations are deterministic.",
      "Intervals are half-open [start, end); all durations are positive whole minutes.",
      "The scheduler is a bounded greedy list scheduler, not an exhaustive optimal solver."
    ]
  };
}

function baseScheduledTasks(plan: ActionPlan, world: WorldState): ScheduledTask[] {
  return plan.tasks.map((task) => ({
    taskId: task.id,
    name: task.name,
    phase: task.phase,
    optional: task.optional,
    status: "unschedulable",
    startMinute: null,
    endMinute: null,
    durationMinutes: world.taskDurationOverrides[task.id] ?? task.durationMinutes,
    dependsOn: [...task.dependsOn],
    resourcesRequired: [...task.resources],
    resourcesAssigned: [],
    ingredients: task.ingredients.map((ingredient) => ({ ...ingredient })),
    slackMinutes: null,
    reason: null
  }));
}

function blockedResult(
  world: WorldState,
  plan: ActionPlan,
  violations: ConstraintViolation[]
): ScheduleResult {
  return {
    planId: plan.id,
    mealId: plan.mealId,
    worldRevision: world.revision,
    feasible: false,
    deadlineMinute: world.arrivalDeadlineMinute,
    completionMinute: null,
    slackMinutes: null,
    tasks: baseScheduledTasks(plan, world),
    violations,
    resourceIntervals: [],
    evidence: evidence()
  };
}

function findCycle(taskIds: readonly string[], taskMap: ReadonlyMap<string, PlanTask>): string[] {
  const color = new Map<string, 0 | 1 | 2>();
  for (const id of taskIds) color.set(id, 0);
  const stack: string[] = [];
  const cycleNodes = new Set<string>();

  const visit = (id: string): void => {
    const current = color.get(id) ?? 0;
    if (current === 1) {
      const from = stack.indexOf(id);
      if (from >= 0) {
        for (const node of stack.slice(from)) cycleNodes.add(node);
      }
      return;
    }
    if (current === 2) return;
    color.set(id, 1);
    stack.push(id);
    const task = taskMap.get(id);
    if (task) {
      for (const dependency of task.dependsOn) {
        if (taskMap.has(dependency)) visit(dependency);
      }
    }
    stack.pop();
    color.set(id, 2);
  };

  for (const id of taskIds) visit(id);
  return [...cycleNodes].sort();
}

function resourceCandidates(
  world: WorldState,
  task: PlanTask
): { chosen: string[]; issues: ConstraintViolation[] } {
  const chosen: string[] = [];
  const issues: ConstraintViolation[] = [];
  for (const primary of task.resources) {
    const candidates = [primary, ...(task.resourceAlternatives?.[primary] ?? [])];
    let selected: string | null = null;
    for (const candidateId of candidates) {
      const resource = world.resources[candidateId];
      if (!resource) {
        if (candidateId === primary) {
          issues.push(
            violation("UNKNOWN_RESOURCE", "error", `Resource "${candidateId}" is not defined.`, {
              taskId: task.id,
              resourceId: candidateId
            })
          );
        }
        continue;
      }
      if (resource.available && resource.capacity > 0) {
        selected = candidateId;
        break;
      }
    }
    if (selected) {
      if (!chosen.includes(selected)) chosen.push(selected);
      continue;
    }
    const severity = task.optional ? "warning" : "error";
    issues.push(
      violation(
        "RESOURCE_UNAVAILABLE",
        severity,
        `No usable resource is available for "${primary}" on task "${task.name}".`,
        { taskId: task.id, resourceId: primary }
      )
    );
  }
  return { chosen, issues };
}

function findEarliestSlot(
  world: WorldState,
  resourceIds: readonly string[],
  earliest: Minutes,
  duration: number,
  calendars: ReadonlyMap<string, CalendarInterval[]>
): Minutes | null {
  if (resourceIds.length === 0) return earliest;

  const candidates = new Set<number>([earliest]);
  for (const resourceId of resourceIds) {
    for (const interval of calendars.get(resourceId) ?? []) {
      if (interval.endMinute >= earliest) candidates.add(interval.endMinute);
    }
  }
  const sorted = [...candidates].sort((a, b) => a - b);

  for (const start of sorted) {
    const end = start + duration;
    let fits = true;
    for (const resourceId of resourceIds) {
      const resource = world.resources[resourceId];
      if (!resource || !resource.available || resource.capacity <= 0) {
        fits = false;
        break;
      }
      const occupied = (calendars.get(resourceId) ?? []).filter(
        (interval) => interval.startMinute < end && interval.endMinute > start
      ).length;
      if (occupied >= resource.capacity) {
        fits = false;
        break;
      }
    }
    if (fits) return start;
  }
  return null;
}

function hasDependenciesScheduled(
  task: PlanTask,
  byId: ReadonlyMap<string, ScheduledInternal>,
  unschedulable: ReadonlySet<string>
): boolean {
  return task.dependsOn.every((dependency) => {
    if (unschedulable.has(dependency)) return false;
    const scheduled = byId.get(dependency);
    return scheduled?.status === "scheduled" && scheduled.endMinute !== null;
  });
}

function anyDependencyUnschedulable(
  task: PlanTask,
  unschedulable: ReadonlySet<string>
): string | null {
  for (const dependency of task.dependsOn) {
    if (unschedulable.has(dependency)) return dependency;
  }
  return null;
}

function validateStructure(
  world: WorldState,
  plan: ActionPlan
): { violations: ConstraintViolation[]; taskMap: Map<string, PlanTask> } {
  const violations: ConstraintViolation[] = [];
  const taskMap = new Map<string, PlanTask>();

  if (plan.tasks.length === 0) {
    violations.push(violation("INVALID_TASK", "error", "The plan contains no tasks."));
  }

  for (const task of plan.tasks) {
    if (!task.id || !/^[a-z][a-z0-9_]{2,80}$/.test(task.id)) {
      violations.push(
        violation("INVALID_TASK", "error", `Invalid task id "${task.id}".`, { taskId: task.id })
      );
      continue;
    }
    if (taskMap.has(task.id)) {
      violations.push(
        violation("DUPLICATE_TASK", "error", `Duplicate task id "${task.id}".`, {
          taskId: task.id
        })
      );
      continue;
    }
    taskMap.set(task.id, task);
    if (!Number.isInteger(task.durationMinutes) || task.durationMinutes <= 0) {
      violations.push(
        violation(
          "INVALID_DURATION",
          "error",
          `Task "${task.name}" must have a positive whole-minute duration.`,
          { taskId: task.id }
        )
      );
    }
    for (const dependency of task.dependsOn) {
      if (!plan.tasks.some((candidate) => candidate.id === dependency)) {
        violations.push(
          violation(
            "UNKNOWN_DEPENDENCY",
            "error",
            `Task "${task.name}" depends on missing task "${dependency}".`,
            { taskId: task.id }
          )
        );
      }
    }
    for (const override of [world.taskDurationOverrides[task.id]]) {
      if (
        override !== undefined &&
        (!Number.isInteger(override) || override <= 0)
      ) {
        violations.push(
          violation(
            "INVALID_DURATION",
            "error",
            `Duration override for "${task.name}" must be a positive whole number.`,
            { taskId: task.id }
          )
        );
      }
    }
  }

  if (violations.some((entry) => entry.code === "DUPLICATE_TASK" || entry.code === "INVALID_TASK")) {
    return { violations, taskMap };
  }

  const cycle = findCycle([...taskMap.keys()], taskMap);
  if (cycle.length > 0) {
    violations.push(
      violation(
        "DEPENDENCY_CYCLE",
        "error",
        "Dependency cycle detected among: " + cycle.join(", ") + ".",
        cycle[0] ? { taskId: cycle[0] } : {}
      )
    );
  }
  return { violations, taskMap };
}

/**
 * Calculate a schedule. Pure: the input world and plan are not mutated.
 */
export function schedulePlan(world: WorldState, plan: ActionPlan): ScheduleResult {
  const structural = validateStructure(world, plan);
  if (structural.violations.some((entry) => entry.severity === "error")) {
    return blockedResult(world, plan, structural.violations);
  }

  const violations: ConstraintViolation[] = [...structural.violations];
  const byId = new Map<string, ScheduledInternal>();
  const unschedulable = new Set<string>();
  const calendars = new Map<string, CalendarInterval[]>();
  const resourceIntervals: ResourceInterval[] = [];
  const evidenceData = evidence();

  for (const [index, task] of plan.tasks.entries()) {
    byId.set(task.id, {
      task,
      orderIndex: index,
      status: "unschedulable",
      startMinute: null,
      endMinute: null,
      resourcesAssigned: [],
      reason: null
    });
  }

  // Allocate finite ingredient quantities deterministically. Mandatory tasks
  // reserve before optional tasks so optional work cannot starve the dinner.
  const allocated = new Map<string, number>();
  const ingredientBlocked = new Map<string, string>();
  const allocationOrder = [...plan.tasks].sort((a, b) => {
    if (a.optional !== b.optional) return a.optional ? 1 : -1;
    return plan.tasks.indexOf(a) - plan.tasks.indexOf(b);
  });
  for (const task of allocationOrder) {
    for (const requirement of task.ingredients) {
      const ingredient = world.inventory[requirement.ingredientId];
      if (!ingredient) {
        ingredientBlocked.set(task.id, `Ingredient "${requirement.ingredientId}" is missing.`);
        violations.push(
          violation(
            "MISSING_INGREDIENT",
            task.optional ? "warning" : "error",
            `${task.name} needs ${requirement.quantity} ${requirement.ingredientId}, but it is missing from inventory.`,
            { taskId: task.id, ingredientId: requirement.ingredientId }
          )
        );
        break;
      }
      const alreadyAllocated = allocated.get(requirement.ingredientId) ?? 0;
      if (alreadyAllocated + requirement.quantity > ingredient.quantity + 1e-9) {
        ingredientBlocked.set(
          task.id,
          `Insufficient ${ingredient.name}: needs ${requirement.quantity} ${ingredient.unit}.`
        );
        violations.push(
          violation(
            "INSUFFICIENT_INGREDIENT",
            task.optional ? "warning" : "error",
            `${task.name} cannot be supplied: only ${Math.max(0, ingredient.quantity - alreadyAllocated).toFixed(2)} ${ingredient.unit} ${ingredient.name} remains unreserved.`,
            { taskId: task.id, ingredientId: requirement.ingredientId }
          )
        );
        break;
      }
      allocated.set(requirement.ingredientId, alreadyAllocated + requirement.quantity);
    }
  }

  // Resolve resource alternatives once. If a mandatory task has no usable
  // resource it is unschedulable, regardless of how much time is available.
  const resolvedResources = new Map<string, string[]>();
  for (const task of plan.tasks) {
    const resolved = resourceCandidates(world, task);
    if (resolved.issues.length > 0) {
      violations.push(...resolved.issues);
      if (resolved.chosen.length !== task.resources.length) {
        const reason = resolved.issues[0]?.message ?? "Required resource is unavailable.";
        const internal = byId.get(task.id);
        if (internal) {
          internal.status = task.optional ? "skipped" : "unschedulable";
          internal.reason = reason;
        }
        if (!task.optional) unschedulable.add(task.id);
        continue;
      }
    }
    resolvedResources.set(task.id, resolved.chosen);
  }

  // Optional tasks with blocked ingredients are omitted. Mandatory blocked
  // tasks are marked unschedulable before list scheduling.
  for (const [taskId, reason] of ingredientBlocked) {
    const internal = byId.get(taskId);
    if (!internal) continue;
    internal.status = internal.task.optional ? "skipped" : "unschedulable";
    internal.reason = reason;
    if (!internal.task.optional) unschedulable.add(taskId);
  }

  const pending = new Set(
    plan.tasks
      .filter((task) => !unschedulable.has(task.id) && byId.get(task.id)?.status !== "skipped")
      .map((task) => task.id)
  );

  // Propagate unschedulable dependencies through optional and mandatory tasks.
  let changed = true;
  while (changed) {
    changed = false;
    for (const taskId of [...pending]) {
      const internal = byId.get(taskId);
      if (!internal) continue;
      const dependency = anyDependencyUnschedulable(internal.task, unschedulable);
      if (!dependency) continue;
      internal.status = internal.task.optional ? "skipped" : "unschedulable";
      internal.reason = `Dependency "${dependency}" cannot be scheduled.`;
      pending.delete(taskId);
      if (!internal.task.optional) {
        unschedulable.add(taskId);
        violations.push(
          violation(
            "DEPENDENCY_UNSCHEDULED",
            "error",
            `${internal.task.name} cannot run because dependency "${dependency}" is unschedulable.`,
            { taskId }
          )
        );
      } else {
        violations.push(
          violation(
            "DEPENDENCY_UNSCHEDULED",
            "warning",
            `Optional task "${internal.task.name}" was omitted because dependency "${dependency}" is unschedulable.`,
            { taskId }
          )
        );
      }
      changed = true;
    }
  }

  while (pending.size > 0) {
    const candidates: {
      task: PlanTask;
      orderIndex: number;
      earliest: Minutes;
      start: Minutes;
      duration: number;
      resources: string[];
      ingredientWait: boolean;
    }[] = [];

    for (const taskId of pending) {
      const internal = byId.get(taskId);
      if (!internal) continue;
      const task = internal.task;
      if (!hasDependenciesScheduled(task, byId, unschedulable)) continue;

      const dependencyEnd = Math.max(
        world.dayStartMinute,
        ...task.dependsOn.map((dependency) => byId.get(dependency)?.endMinute ?? world.dayStartMinute)
      );
      let ingredientAvailable = world.dayStartMinute;
      for (const requirement of task.ingredients) {
        const ingredient = world.inventory[requirement.ingredientId];
        if (!ingredient) {
          ingredientAvailable = Number.POSITIVE_INFINITY;
          break;
        }
        ingredientAvailable = Math.max(ingredientAvailable, ingredient.availableAtMinute);
      }
      if (!Number.isFinite(ingredientAvailable)) {
        internal.status = task.optional ? "skipped" : "unschedulable";
        internal.reason = "Required ingredient is missing.";
        pending.delete(taskId);
        if (!task.optional) unschedulable.add(taskId);
        continue;
      }

      const duration = world.taskDurationOverrides[task.id] ?? task.durationMinutes;
      const earliest = Math.max(
        dependencyEnd,
        ingredientAvailable,
        task.notBeforeMinute ?? world.dayStartMinute
      );
      const resources = resolvedResources.get(task.id) ?? [];
      const start = findEarliestSlot(world, resources, earliest, duration, calendars);
      evidenceData.candidateEvaluations += 1;
      if (start === null) {
        internal.status = task.optional ? "skipped" : "unschedulable";
        internal.reason = "No capacity slot could be found for the required resources.";
        pending.delete(taskId);
        if (!task.optional) unschedulable.add(taskId);
        continue;
      }
      candidates.push({
        task,
        orderIndex: internal.orderIndex,
        earliest,
        start,
        duration,
        resources,
        ingredientWait: ingredientAvailable > dependencyEnd
      });
    }

    if (candidates.length === 0) break;

    candidates.sort(
      (a, b) =>
        a.start - b.start ||
        a.orderIndex - b.orderIndex ||
        a.task.id.localeCompare(b.task.id)
    );
    const selected = candidates[0];
    if (!selected) break;
    const internal = byId.get(selected.task.id);
    if (!internal) break;

    internal.status = "scheduled";
    internal.startMinute = selected.start;
    internal.endMinute = selected.start + selected.duration;
    internal.resourcesAssigned = [...selected.resources];
    pending.delete(selected.task.id);

    for (const resourceId of selected.resources) {
      const list = calendars.get(resourceId) ?? [];
      list.push({
        startMinute: selected.start,
        endMinute: selected.start + selected.duration
      });
      calendars.set(resourceId, list);
      resourceIntervals.push({
        resourceId,
        taskId: selected.task.id,
        startMinute: selected.start,
        endMinute: selected.start + selected.duration
      });
    }
    if (selected.start > selected.earliest) evidenceData.resourceWaitCount += 1;
    if (selected.ingredientWait) evidenceData.ingredientWaitCount += 1;
  }

  // Anything still pending is genuinely blocked, not silently dropped.
  for (const taskId of pending) {
    const internal = byId.get(taskId);
    if (!internal) continue;
    internal.status = internal.task.optional ? "skipped" : "unschedulable";
    internal.reason = "Task remained blocked after scheduling.";
    if (!internal.task.optional) {
      unschedulable.add(taskId);
      violations.push(
        violation(
          "TASK_UNSCHEDULED",
          "error",
          `${internal.task.name} could not be scheduled.`,
          { taskId }
        )
      );
    }
  }

  const scheduledInternals = [...byId.values()].filter(
    (entry) => entry.status === "scheduled" && entry.endMinute !== null
  );
  const completionMinute =
    scheduledInternals.length > 0
      ? Math.max(...scheduledInternals.map((entry) => entry.endMinute ?? 0))
      : null;

  if (completionMinute !== null && completionMinute > world.arrivalDeadlineMinute) {
    violations.push(
      violation(
        "DEADLINE_MISSED",
        "error",
        `Projected completion ${formatTime(completionMinute)} is ${completionMinute - world.arrivalDeadlineMinute} minutes after the ${formatTime(world.arrivalDeadlineMinute)} guest deadline.`
      )
    );
  }

  const mandatoryUnscheduled = [...byId.values()].filter(
    (entry) => !entry.task.optional && entry.status !== "scheduled"
  );
  for (const entry of mandatoryUnscheduled) {
    if (!violations.some((issue) => issue.taskId === entry.task.id)) {
      violations.push(
        violation(
          "TASK_UNSCHEDULED",
          "error",
          `Mandatory task "${entry.task.name}" is not scheduled.`,
          { taskId: entry.task.id }
        )
      );
    }
  }

  // Deduplicate repeated messages while preserving first-seen order.
  const seenViolations = new Set<string>();
  const uniqueViolations = violations.filter((entry) => {
    const key = [entry.code, entry.taskId ?? "", entry.resourceId ?? "", entry.ingredientId ?? "", entry.message].join("|");
    if (seenViolations.has(key)) return false;
    seenViolations.add(key);
    return true;
  });

  const tasks: ScheduledTask[] = [...byId.values()]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((entry) => ({
      taskId: entry.task.id,
      name: entry.task.name,
      phase: entry.task.phase,
      optional: entry.task.optional,
      status: entry.status,
      startMinute: entry.startMinute,
      endMinute: entry.endMinute,
      durationMinutes:
        entry.endMinute !== null && entry.startMinute !== null
          ? entry.endMinute - entry.startMinute
          : world.taskDurationOverrides[entry.task.id] ?? entry.task.durationMinutes,
      dependsOn: [...entry.task.dependsOn],
      resourcesRequired: [...entry.task.resources],
      resourcesAssigned: [...entry.resourcesAssigned],
      ingredients: entry.task.ingredients.map((ingredient) => ({ ...ingredient })),
      slackMinutes:
        entry.endMinute === null ? null : world.arrivalDeadlineMinute - entry.endMinute,
      reason: entry.reason
    }));

  evidenceData.selectedTaskOrder = scheduledInternals
    .sort(
      (a, b) =>
        (a.startMinute ?? 0) - (b.startMinute ?? 0) ||
        a.orderIndex - b.orderIndex
    )
    .map((entry) => entry.task.id);

  const feasible =
    completionMinute !== null &&
    completionMinute <= world.arrivalDeadlineMinute &&
    mandatoryUnscheduled.length === 0 &&
    !uniqueViolations.some((entry) => entry.severity === "error");

  return {
    planId: plan.id,
    mealId: plan.mealId,
    worldRevision: world.revision,
    feasible,
    deadlineMinute: world.arrivalDeadlineMinute,
    completionMinute,
    slackMinutes:
      completionMinute === null ? null : world.arrivalDeadlineMinute - completionMinute,
    tasks,
    violations: uniqueViolations,
    resourceIntervals: resourceIntervals.sort(
      (a, b) => a.startMinute - b.startMinute || a.resourceId.localeCompare(b.resourceId)
    ),
    evidence: evidenceData
  };
}

export function evaluateSchedule(world: WorldState, plan: ActionPlan, schedule: ScheduleResult) {
  const errors = schedule.violations.filter((entry) => entry.severity === "error");
  const unscheduledMandatory = schedule.tasks.filter(
    (task) => !task.optional && task.status !== "scheduled"
  );
  const skippedOptional = schedule.tasks.filter(
    (task) => task.optional && task.status !== "scheduled"
  );
  const summary = schedule.feasible
    ? `Feasible: completes at ${schedule.completionMinute}, with ${schedule.slackMinutes} minutes of slack.`
    : errors.length > 0
      ? `Infeasible: ${errors.length} hard constraint${errors.length === 1 ? "" : "s"} violated.`
      : "Infeasible: the plan does not finish by the guest deadline.";

  return {
    planId: plan.id,
    feasible: schedule.feasible,
    summary,
    violations: errors.map((entry) => entry.message),
    metrics: {
      completionMinute: schedule.completionMinute,
      slackMinutes: schedule.slackMinutes,
      scheduledTasks: schedule.tasks.filter((task) => task.status === "scheduled").length,
      unscheduledMandatoryTasks: unscheduledMandatory.length,
      skippedOptionalTasks: skippedOptional.length
    }
  };
}
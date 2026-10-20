// FORKCAST Deterministic Scheduler
// Dependency-aware task scheduling with resource constraints

import type { WorldState, PlanTask, ConstraintViolation, SimulationOutcome, TaskDependency } from './types';
import { cloneWorld } from './worldModel';

interface ScheduledTask {
  task: PlanTask;
  startTime: number;
  finishTime: number;
  slack: number;
}

/**
 * Detect dependency cycles using DFS
 */
function detectCycles(tasks: PlanTask[]): string[] | null {
  const adj = new Map<string, string[]>();
  for (const t of tasks) {
    const deps = t.dependencies.map(d => d.taskId);
    adj.set(t.id, deps);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const cycleNodes: string[] = [];

  function dfs(node: string): boolean {
    if (inStack.has(node)) {
      cycleNodes.push(node);
      return true;
    }
    if (visited.has(node)) return false;
    visited.add(node);
    inStack.add(node);
    for (const dep of (adj.get(node) || [])) {
      if (dfs(dep)) return true;
    }
    inStack.delete(node);
    return false;
  }

  for (const t of tasks) {
    if (dfs(t.id)) return cycleNodes;
  }
  return null;
}

/**
 * Topological sort of tasks respecting dependencies
 */
function topologicalSort(tasks: PlanTask[]): PlanTask[] {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const t of tasks) {
    inDegree.set(t.id, t.dependencies.length);
    for (const dep of t.dependencies) {
      if (!dependents.has(dep.taskId)) {
        dependents.set(dep.taskId, []);
      }
      dependents.get(dep.taskId)!.push(t.id);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: PlanTask[] = [];
  while (queue.length > 0) {
    // Sort by critical path priority then by duration (longer first)
    queue.sort((a, b) => {
      const ta = taskMap.get(a)!;
      const tb = taskMap.get(b)!;
      if (ta.criticalPath !== tb.criticalPath) return ta.criticalPath ? -1 : 1;
      return tb.duration - ta.duration;
    });

    const id = queue.shift()!;
    sorted.push(taskMap.get(id)!);

    for (const depId of (dependents.get(id) || [])) {
      inDegree.set(depId, inDegree.get(depId)! - 1);
      if (inDegree.get(depId) === 0) {
        queue.push(depId);
      }
    }
  }

  return sorted;
}

/**
 * Check ingredient availability at a given time
 */
function checkIngredientAvailability(
  world: WorldState,
  task: PlanTask,
  startTime: number
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  for (const req of task.requiredIngredients) {
    const ingredient = world.inventory.ingredients[req.ingredientId];
    if (!ingredient) {
      violations.push({
        type: 'MISSING_INGREDIENT',
        taskId: task.id,
        description: `Ingredient "${req.ingredientId}" not found in inventory`,
        severity: 'fatal',
        details: `Task "${task.name}" requires ${req.quantity} of "${req.ingredientId}" but it does not exist.`,
      });
      continue;
    }

    if (ingredient.quantity < req.quantity) {
      violations.push({
        type: 'MISSING_INGREDIENT',
        taskId: task.id,
        description: `Insufficient "${ingredient.name}" (need ${req.quantity} ${ingredient.unit}, have ${ingredient.quantity})`,
        severity: 'fatal',
        details: `Task "${task.name}" requires ${req.quantity} ${ingredient.unit} of "${ingredient.name}" but only ${ingredient.quantity} ${ingredient.unit} available.`,
      });
    }

    if (ingredient.availableAt > startTime) {
      violations.push({
        type: 'MISSING_INGREDIENT',
        taskId: task.id,
        description: `"${ingredient.name}" not available until T+${ingredient.availableAt}min (task starts at T+${startTime}min)`,
        severity: 'critical',
        details: `Task "${task.name}" needs "${ingredient.name}" at T+${startTime}min but it arrives at T+${ingredient.availableAt}min (delayed by ${ingredient.availableAt - startTime}min).`,
      });
    }
  }

  return violations;
}

/**
 * Check resource availability
 */
function checkResourceAvailability(
  world: WorldState,
  task: PlanTask,
  scheduledTasks: ScheduledTask[],
  startTime: number
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  for (const resId of task.requiredResources) {
    const resource = world.resources.find(r => r.id === resId);
    if (!resource) {
      violations.push({
        type: 'RESOURCE_CONFLICT',
        taskId: task.id,
        description: `Resource "${resId}" not found`,
        severity: 'fatal',
        details: `Task "${task.name}" requires resource "${resId}" which does not exist.`,
      });
      continue;
    }

    if (!resource.available) {
      violations.push({
        type: 'RESOURCE_CONFLICT',
        taskId: task.id,
        description: `Resource "${resource.name}" is unavailable`,
        severity: 'critical',
        details: `Task "${task.name}" requires "${resource.name}" which is currently disabled/unavailable.`,
      });
      continue;
    }

    // Check for concurrent usage conflicts
    const concurrentUsers = scheduledTasks.filter(st =>
      st.task.requiredResources.includes(resId) &&
      st.startTime < startTime + task.duration &&
      st.finishTime > startTime
    );

    if (concurrentUsers.length >= resource.capacity) {
      violations.push({
        type: 'RESOURCE_CONFLICT',
        taskId: task.id,
        description: `Resource "${resource.name}" already in use by ${concurrentUsers.length} task(s)`,
        severity: 'warning',
        details: `Task "${task.name}" conflicts with: ${concurrentUsers.map(s => s.task.name).join(', ')}`,
      });
    }
  }

  return violations;
}

/**
 * Main scheduling algorithm
 */
export function scheduleTasks(world: WorldState): {
  scheduledTasks: ScheduledTask[];
  violations: ConstraintViolation[];
  feasible: boolean;
  completionTime: number;
} {
  const workingWorld = cloneWorld(world);
  const tasks = workingWorld.tasks;
  const violations: ConstraintViolation[] = [];

  // Check for cycles
  const cycleNodes = detectCycles(tasks);
  if (cycleNodes) {
    violations.push({
      type: 'DEPENDENCY_CYCLE',
      description: `Dependency cycle detected involving: ${cycleNodes.join(', ')}`,
      severity: 'fatal',
      details: 'Cannot schedule tasks with circular dependencies.',
    });
    return { scheduledTasks: [], violations, feasible: false, completionTime: Infinity };
  }

  // Topological sort
  const sorted = topologicalSort(tasks);
  const scheduled: ScheduledTask[] = [];
  const scheduledMap = new Map<string, ScheduledTask>();

  for (const task of sorted) {
    // Calculate earliest start based on dependencies
    let earliestStart = 0;
    for (const dep of task.dependencies) {
      const depScheduled = scheduledMap.get(dep.taskId);
      if (!depScheduled) {
        violations.push({
          type: 'MISSING_INGREDIENT', // using as generic "missing dependency"
          taskId: task.id,
          description: `Dependency "${dep.taskId}" not found in schedule`,
          severity: 'fatal',
          details: `Task "${task.name}" depends on "${dep.taskId}" which was not scheduled.`,
        });
        continue;
      }

      if (dep.type === 'finish-start') {
        earliestStart = Math.max(earliestStart, depScheduled.finishTime + dep.lagMinutes);
      } else if (dep.type === 'start-start') {
        earliestStart = Math.max(earliestStart, depScheduled.startTime + dep.lagMinutes);
      }
    }

    // Check for resource conflicts and find earliest available slot
    let startTime = earliestStart;
    const maxIterations = 100; // bounded search
    let iterations = 0;
    let resourceConflict = true;

    while (resourceConflict && iterations < maxIterations) {
      resourceConflict = false;
      for (const resId of task.requiredResources) {
        const resource = workingWorld.resources.find(r => r.id === resId);
        if (!resource || !resource.available) {
          resourceConflict = true;
          break;
        }

        const concurrentUsers = scheduled.filter(st =>
          st.task.requiredResources.includes(resId) &&
          st.startTime < startTime + task.duration &&
          st.finishTime > startTime
        );

        if (concurrentUsers.length >= resource.capacity) {
          // Push start time past the earliest finishing concurrent task
          const earliestFinish = Math.min(...concurrentUsers.map(s => s.finishTime));
          startTime = Math.max(startTime, earliestFinish);
          resourceConflict = true;
          break;
        }
      }
      iterations++;
    }

    // Check ingredient availability
    const ingredientViolations = checkIngredientAvailability(workingWorld, task, startTime);
    violations.push(...ingredientViolations);

    // If ingredients not available, delay task
    for (const v of ingredientViolations) {
      if (v.type === 'MISSING_INGREDIENT' && v.severity === 'critical') {
        const match = v.description.match(/not available until T\+(\d+)min/);
        if (match) {
          startTime = Math.max(startTime, parseInt(match[1]));
        }
      }
    }

    const finishTime = startTime + task.duration;
    const slack = workingWorld.deadline - finishTime;

    const scheduledTask: ScheduledTask = {
      task: { ...task, startTime, finishTime, slack, status: 'pending' },
      startTime,
      finishTime,
      slack,
    };

    scheduled.push(scheduledTask);
    scheduledMap.set(task.id, scheduledTask);
  }

  // Calculate completion time
  const completionTime = scheduled.length > 0
    ? Math.max(...scheduled.map(s => s.finishTime))
    : 0;

  // Check deadline
  if (completionTime > workingWorld.deadline) {
    violations.push({
      type: 'DEADLINE',
      description: `Plan completes at T+${completionTime}min, which is ${completionTime - workingWorld.deadline}min past the deadline (T+${workingWorld.deadline}min)`,
      severity: 'critical',
      details: `The schedule finishes at minute ${completionTime} but guests arrive at minute ${workingWorld.deadline}. The plan is ${completionTime - workingWorld.deadline} minutes late.`,
    });
  }

  const feasible = !violations.some(v => v.severity === 'fatal');

  return { scheduledTasks: scheduled, violations, feasible, completionTime };
}

/**
 * Run a full simulation and return structured outcome
 */
export function simulateWorld(world: WorldState, scenarioId: string = 'baseline'): SimulationOutcome {
  const { scheduledTasks, violations, feasible, completionTime } = scheduleTasks(world);

  const lateness = completionTime - world.deadline;
  const affectedTasks = violations.map(v => v.taskId).filter(Boolean) as string[];

  return {
    scenarioId,
    feasible,
    completionTime,
    lateness,
    violations,
    affectedTasks: [...new Set(affectedTasks)],
    taskResults: scheduledTasks.map(st => ({
      taskId: st.task.id,
      startTime: st.startTime,
      finishTime: st.finishTime,
      status: st.task.status,
    })),
    explanation: generateExplanation(feasible, completionTime, world.deadline, violations),
  };
}

function generateExplanation(feasible: boolean, completionTime: number, deadline: number, violations: ConstraintViolation[]): string {
  if (!feasible) {
    const fatalViolations = violations.filter(v => v.severity === 'fatal');
    return `INFEASIBLE: ${fatalViolations.length} fatal constraint(s) prevent execution. ${fatalViolations.map(v => v.description).join('; ')}`;
  }

  if (completionTime > deadline) {
    return `Schedule completes at T+${completionTime}min (${completionTime - deadline}min late). ${violations.filter(v => v.severity === 'critical').length} critical constraint(s) violated.`;
  }

  const slack = deadline - completionTime;
  if (violations.length === 0) {
    return `Plan is feasible. Completes at T+${completionTime}min with ${slack}min buffer before deadline.`;
  }

  return `Plan is feasible with warnings. Completes at T+${completionTime}min. ${violations.length} warning(s) noted.`;
}

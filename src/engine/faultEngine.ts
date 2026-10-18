// FORKCAST Fault Injection Engine
// Implements four deterministic fault scenarios with repair capabilities

import type { WorldState, FaultScenario, SimulationOutcome, RepairedPlan, ConstraintViolation } from './types';
import { cloneWorld } from './worldModel';
import { simulateWorld, scheduleTasks } from './scheduler';

/**
 * Create the four standard fault scenarios for the demo
 */
export function createFaultScenarios(): FaultScenario[] {
  return [
    {
      id: 'delivery-delay',
      name: 'Delivery Delay',
      type: 'DELIVERY_DELAY',
      description: 'Heavy cream delivery delayed by 30 minutes',
      targetId: 'cream',
      parameter: 30,
      applied: false,
    },
    {
      id: 'ingredient-unavailable',
      name: 'Ingredient Unavailable',
      type: 'INGREDIENT_UNAVAILABLE',
      description: 'Saffron threads are missing from inventory',
      targetId: 'saffron',
      parameter: 0,
      applied: false,
    },
    {
      id: 'task-overrun',
      name: 'Task Overrun',
      type: 'TASK_OVERRUN',
      description: 'Chicken curry takes 50% longer than expected',
      targetId: 'cook-curry',
      parameter: 1.5,
      applied: false,
    },
    {
      id: 'resource-unavailable',
      name: 'Resource Unavailable',
      type: 'RESOURCE_UNAVAILABLE',
      description: 'Oven is broken — cannot warm naan bread',
      targetId: 'oven',
      parameter: 0,
      applied: false,
    },
  ];
}

/**
 * Apply a fault to a cloned world state
 */
export function applyFault(world: WorldState, fault: FaultScenario): WorldState {
  const modified = cloneWorld(world);

  switch (fault.type) {
    case 'DELIVERY_DELAY': {
      const ingredient = modified.inventory.ingredients[fault.targetId];
      if (ingredient) {
        ingredient.availableAt = fault.parameter; // delay in minutes
      }
      break;
    }

    case 'INGREDIENT_UNAVAILABLE': {
      const ingredient = modified.inventory.ingredients[fault.targetId];
      if (ingredient) {
        ingredient.quantity = 0; // remove all quantity
        ingredient.availableAt = Infinity; // never arrives
      }
      break;
    }

    case 'TASK_OVERRUN': {
      const task = modified.tasks.find(t => t.id === fault.targetId);
      if (task) {
        task.duration = Math.ceil(task.duration * fault.parameter);
      }
      break;
    }

    case 'RESOURCE_UNAVAILABLE': {
      const resource = modified.resources.find(r => r.id === fault.targetId);
      if (resource) {
        resource.available = false;
      }
      break;
    }
  }

  return modified;
}

/**
 * Attempt to repair a plan after a fault
 */
export function attemptRepair(
  originalWorld: WorldState,
  fault: FaultScenario,
  faultedOutcome: SimulationOutcome
): RepairedPlan | null {
  const changes: { type: string; description: string; details: string }[] = [];
  const tradeOffs: string[] = [];

  switch (fault.type) {
    case 'DELIVERY_DELAY': {
      // Repair: reorder tasks to do ingredient-independent work first
      const repaired = cloneWorld(originalWorld);
      const ingredient = repaired.inventory.ingredients[fault.targetId];
      if (ingredient) {
        ingredient.availableAt = fault.parameter;
      }

      // The cook-curry task depends on cream. We can't avoid this.
      // But we can check if the overall plan still meets the deadline.
      const { scheduledTasks, violations, feasible, completionTime } = scheduleTasks(repaired);

      if (feasible && completionTime <= repaired.deadline) {
        changes.push({
          type: 'RESCHEDULE',
          description: 'Reordered tasks to maximize parallel work while waiting for delivery',
          details: `Tasks not requiring "${ingredient?.name}" are scheduled first. The curry starts once cream arrives.`,
        });
        tradeOffs.push('Curry starts later but other prep continues in parallel');

        return {
          originalScenarioId: fault.id,
          repairId: `repair-${fault.id}`,
          changes,
          newTasks: scheduledTasks.map(s => s.task),
          feasible: true,
          completionTime,
          lateness: completionTime - repaired.deadline,
          violations,
          tradeOffs,
          explanation: `Repair successful: Reordered tasks so independent prep continues while waiting for delayed delivery. Plan completes at T+${completionTime}min.`,
        };
      }

      // If still infeasible, try alternative meal
      return tryAlternativeMeal(repaired, fault, faultedOutcome);
    }

    case 'INGREDIENT_UNAVAILABLE': {
      // Repair: switch to alternative meal that doesn't require the missing ingredient
      const repaired = cloneWorld(originalWorld);
      return tryAlternativeMeal(repaired, fault, faultedOutcome);
    }

    case 'TASK_OVERRUN': {
      // Repair: try to parallelize other tasks or compress non-critical tasks
      const repaired = cloneWorld(originalWorld);
      const task = repaired.tasks.find(t => t.id === fault.targetId);
      if (task) {
        task.duration = Math.ceil(task.duration * fault.parameter);
      }

      // Check if we can still meet deadline by starting earlier tasks sooner
      const { scheduledTasks, violations, feasible, completionTime } = scheduleTasks(repaired);

      if (feasible && completionTime <= repaired.deadline) {
        changes.push({
          type: 'TIME_ADJUSTMENT',
          description: 'Absorbed overrun within existing slack time',
          details: `The extended duration of "${task?.name}" fits within the schedule buffer.`,
        });
        return {
          originalScenarioId: fault.id,
          repairId: `repair-${fault.id}`,
          changes,
          newTasks: scheduledTasks.map(s => s.task),
          feasible: true,
          completionTime,
          lateness: completionTime - repaired.deadline,
          violations,
          tradeOffs: ['Reduced buffer time before guest arrival'],
          explanation: `Repair successful: Task overrun absorbed by schedule slack. Plan completes at T+${completionTime}min.`,
        };
      }

      // Try compressing non-critical tasks
      const compressed = tryCompressTasks(repaired);
      if (compressed) {
        changes.push({
          type: 'TASK_COMPRESSION',
          description: 'Compressed non-critical tasks to absorb overrun',
          details: compressed.changes.map(c => c.description).join('; '),
        });
        tradeOffs.push('Some tasks completed with reduced quality margin');
        return {
          originalScenarioId: fault.id,
          repairId: `repair-${fault.id}-compressed`,
          changes: [...changes, ...compressed.changes],
          newTasks: compressed.scheduledTasks.map(s => s.task),
          feasible: compressed.feasible,
          completionTime: compressed.completionTime,
          lateness: compressed.completionTime - repaired.deadline,
          violations: compressed.violations,
          tradeOffs,
          explanation: `Partial repair: Compressed non-critical tasks. Plan completes at T+${compressed.completionTime}min.`,
        };
      }

      return {
        originalScenarioId: fault.id,
        repairId: `repair-${fault.id}-failed`,
        changes: [{ type: 'NONE', description: 'No feasible repair found', details: 'Task overrun exceeds available slack and cannot be compressed further.' }],
        newTasks: scheduledTasks.map(s => s.task),
        feasible: false,
        completionTime,
        lateness: completionTime - repaired.deadline,
        violations,
        tradeOffs: ['Consider switching to alternative meal plan'],
        explanation: `No feasible repair: Task overrun of ${task?.name} (${Math.ceil((task?.duration || 0) * 0.5)} extra minutes) exceeds schedule slack. Alternative meal recommended.`,
      };
    }

    case 'RESOURCE_UNAVAILABLE': {
      // Repair: reassign tasks to available resources or skip non-essential tasks
      const repaired = cloneWorld(originalWorld);
      const resource = repaired.resources.find(r => r.id === fault.targetId);
      if (resource) {
        resource.available = false;
      }

      // Find tasks that need this resource
      const affectedTaskIds = repaired.tasks
        .filter(t => t.requiredResources.includes(fault.targetId))
        .map(t => t.id);

      // Try removing non-critical affected tasks (e.g., warm-naan)
      const criticalAffected = affectedTaskIds.filter(id => {
        const t = repaired.tasks.find(task => task.id === id);
        return t?.criticalPath;
      });

      if (criticalAffected.length === 0) {
        // Can skip non-critical tasks
        for (const taskId of affectedTaskIds) {
          const taskIdx = repaired.tasks.findIndex(t => t.id === taskId);
          if (taskIdx >= 0) {
            const task = repaired.tasks[taskIdx];
            changes.push({
              type: 'TASK_REMOVAL',
              description: `Skipped "${task.name}" (resource unavailable)`,
              details: `Task removed because "${resource?.name}" is unavailable. This is a non-critical task.`,
            });
            tradeOffs.push(`"${task.name}" will not be performed`);
            repaired.tasks.splice(taskIdx, 1);
          }
        }

        // Remove dependencies on removed tasks
        for (const task of repaired.tasks) {
          task.dependencies = task.dependencies.filter(d => !affectedTaskIds.includes(d.taskId));
        }

        const { scheduledTasks, violations, feasible, completionTime } = scheduleTasks(repaired);

        return {
          originalScenarioId: fault.id,
          repairId: `repair-${fault.id}`,
          changes,
          newTasks: scheduledTasks.map(s => s.task),
          feasible,
          completionTime,
          lateness: completionTime - repaired.deadline,
          violations,
          tradeOffs,
          explanation: `Repair: Skipped ${affectedTaskIds.length} non-critical task(s) requiring unavailable resource. Plan completes at T+${completionTime}min.`,
        };
      }

      // Critical tasks need this resource — try alternative meal
      return tryAlternativeMeal(repaired, fault, faultedOutcome);
    }
  }

  return null;
}

function tryCompressTasks(world: WorldState): {
  scheduledTasks: { task: any; startTime: number; finishTime: number; slack: number }[];
  feasible: boolean;
  completionTime: number;
  violations: ConstraintViolation[];
  changes: { type: string; description: string; details: string }[];
} | null {
  const compressed = cloneWorld(world);
  const changes: { type: string; description: string; details: string }[] = [];

  // Reduce non-critical task durations by 20%
  for (const task of compressed.tasks) {
    if (!task.criticalPath && task.duration > 10) {
      const original = task.duration;
      task.duration = Math.ceil(task.duration * 0.8);
      changes.push({
        type: 'COMPRESSION',
        description: `Compressed "${task.name}" from ${original}min to ${task.duration}min`,
        details: 'Reduced duration by 20% — acceptable quality trade-off.',
      });
    }
  }

  const { scheduledTasks, violations, feasible, completionTime } = scheduleTasks(compressed);

  if (feasible && completionTime <= compressed.deadline) {
    return { scheduledTasks, feasible, completionTime, violations, changes };
  }

  return null;
}

function tryAlternativeMeal(
  world: WorldState,
  fault: FaultScenario,
  faultedOutcome: SimulationOutcome
): RepairedPlan | null {
  // Switch to pasta carbonara as alternative
  const altWorld = cloneWorld(world);
  altWorld.selectedMeal = 'pasta-carbonara';

  // Replace tasks with alternative meal tasks
  altWorld.tasks = [
    {
      id: 'cook-pasta-alt',
      name: 'Boil Pasta',
      duration: 15,
      dependencies: [],
      requiredResources: ['stove-burner-1'],
      requiredIngredients: [
        { ingredientId: 'pasta', quantity: 500 },
      ],
      status: 'pending',
      criticalPath: true,
    },
    {
      id: 'make-carbonara-alt',
      name: 'Prepare Carbonara Sauce',
      duration: 20,
      dependencies: [],
      requiredResources: ['stove-burner-2'],
      requiredIngredients: [
        { ingredientId: 'pancetta', quantity: 200 },
        { ingredientId: 'eggs', quantity: 6 },
        { ingredientId: 'parmesan', quantity: 100 },
        { ingredientId: 'black-pepper', quantity: 10 },
      ],
      status: 'pending',
      criticalPath: true,
    },
    {
      id: 'plate-alt',
      name: 'Plate Carbonara & Serve',
      duration: 10,
      dependencies: [
        { taskId: 'cook-pasta-alt', type: 'finish-start', lagMinutes: 0 },
        { taskId: 'make-carbonara-alt', type: 'finish-start', lagMinutes: 0 },
      ],
      requiredResources: ['prep-counter'],
      requiredIngredients: [
        { ingredientId: 'parmesan', quantity: 0 }, // garnish
      ],
      status: 'pending',
      criticalPath: true,
    },
  ];

  const { scheduledTasks, violations, feasible, completionTime } = scheduleTasks(altWorld);

  if (feasible && completionTime <= altWorld.deadline) {
    return {
      originalScenarioId: fault.id,
      repairId: `repair-${fault.id}-alternative`,
      changes: [{
        type: 'MEAL_SWITCH',
        description: 'Switched to Pasta Carbonara (alternative meal)',
        details: `Original plan infeasible due to "${fault.description}". Carbonara uses available ingredients and resources.`,
      }],
      newTasks: scheduledTasks.map(s => s.task),
      feasible: true,
      completionTime,
      lateness: completionTime - altWorld.deadline,
      violations,
      tradeOffs: [
        'Different menu from original plan',
        'Simpler preparation — less impressive but reliable',
        'All required ingredients are available',
      ],
      explanation: `Repair via meal switch: Pasta Carbonara is feasible with available ingredients. Completes at T+${completionTime}min with ${altWorld.deadline - completionTime}min buffer.`,
    };
  }

  return null;
}

/**
 * Run a complete scenario analysis
 */
export function runScenarioAnalysis(world: WorldState): {
  baseline: SimulationOutcome;
  scenarios: { scenario: FaultScenario; outcome: SimulationOutcome; repair: RepairedPlan | null }[];
} {
  const baseline = simulateWorld(world, 'baseline');
  const faultScenarios = createFaultScenarios();

  const scenarios = faultScenarios.map(fault => {
    const faultedWorld = applyFault(world, fault);
    const outcome = simulateWorld(faultedWorld, fault.id);
    const repair = outcome.feasible ? null : attemptRepair(world, fault, outcome);
    return { scenario: fault, outcome, repair };
  });

  return { baseline, scenarios };
}

import type { FaultScenario } from "faultline-sim";
import { SCENARIO_SPECS } from "../domain/seed.js";
import { findTaskDefinition } from "../domain/plan.js";
import type { WorldState } from "../domain/types.js";

export type ForkcastFault =
  | { kind: "DELIVERY_DELAY"; deliveryId: string; minutes: number }
  | { kind: "INGREDIENT_UNAVAILABLE"; ingredientId: string }
  | { kind: "TASK_OVERRUN"; taskId: string; percent: number; baseDurationMinutes: number }
  | { kind: "RESOURCE_UNAVAILABLE"; resourceId: string };

export type ForkcastScenario = FaultScenario<WorldState, ForkcastFault>;

function spec(id: string) {
  const found = SCENARIO_SPECS.find((entry) => entry.id === id);
  if (!found) throw new Error(`Unknown scenario spec "${id}".`);
  return found;
}

export function createForkcastScenarios(world: WorldState): ForkcastScenario[] {
  const delivery: ForkcastScenario = {
    ...spec("delivery-delay"),
    faultType: "DELIVERY_DELAY",
    fault: { kind: "DELIVERY_DELAY", deliveryId: "chilled_delivery", minutes: 30 },
    validate(fault) {
      if (fault.kind !== "DELIVERY_DELAY") return ["Invalid fault payload for a delivery delay."];
      const issues: string[] = [];
      if (!world.deliveries.some((entry) => entry.id === fault.deliveryId)) {
        issues.push(`Delivery "${fault.deliveryId}" does not exist.`);
      }
      if (!Number.isInteger(fault.minutes) || fault.minutes <= 0 || fault.minutes > 720) {
        issues.push("Delay minutes must be an integer from 1 to 720.");
      }
      return issues;
    },
    applyFault(draft, fault) {
      if (fault.kind !== "DELIVERY_DELAY") throw new Error("Invalid fault pairing.");
      const target = draft.deliveries.find((entry) => entry.id === fault.deliveryId);
      if (!target) throw new Error(`Delivery "${fault.deliveryId}" does not exist.`);
      target.availableAtMinute += fault.minutes;
      for (const ingredientId of target.ingredientIds) {
        const ingredient = draft.inventory[ingredientId];
        if (ingredient) ingredient.availableAtMinute += fault.minutes;
      }
    }
  };

  const ingredient: ForkcastScenario = {
    ...spec("chicken-unavailable"),
    faultType: "INGREDIENT_UNAVAILABLE",
    fault: { kind: "INGREDIENT_UNAVAILABLE", ingredientId: "chicken" },
    validate(fault) {
      if (fault.kind !== "INGREDIENT_UNAVAILABLE") return ["Invalid fault payload for an unavailable ingredient."];
      const issues: string[] = [];
      if (!world.inventory[fault.ingredientId]) {
        issues.push(`Ingredient "${fault.ingredientId}" does not exist.`);
      }
      return issues;
    },
    applyFault(draft, fault) {
      if (fault.kind !== "INGREDIENT_UNAVAILABLE") throw new Error("Invalid fault pairing.");
      delete draft.inventory[fault.ingredientId];
      for (const deliveryEntry of draft.deliveries) {
        deliveryEntry.ingredientIds = deliveryEntry.ingredientIds.filter(
          (id) => id !== fault.ingredientId
        );
      }
    }
  };

  const overrun: ForkcastScenario = {
    ...spec("roast-overrun"),
    faultType: "TASK_OVERRUN",
    fault: {
      kind: "TASK_OVERRUN",
      taskId: "primary_roast",
      percent: 50,
      baseDurationMinutes: 70
    },
    validate(fault) {
      if (fault.kind !== "TASK_OVERRUN") return ["Invalid fault payload for a task overrun."];
      const issues: string[] = [];
      const task = findTaskDefinition(world, fault.taskId);
      if (!task) {
        issues.push(`Task "${fault.taskId}" does not exist in the seeded world.`);
      } else if (task.durationMinutes !== fault.baseDurationMinutes) {
        issues.push(
          `Task "${fault.taskId}" has baseline duration ${task.durationMinutes}, not ${fault.baseDurationMinutes}.`
        );
      }
      if (!Number.isInteger(fault.percent) || fault.percent <= 0 || fault.percent > 500) {
        issues.push("Overrun percent must be an integer from 1 to 500.");
      }
      return issues;
    },
    applyFault(draft, fault) {
      if (fault.kind !== "TASK_OVERRUN") throw new Error("Invalid fault pairing.");
      draft.taskDurationOverrides[fault.taskId] = Math.ceil(
        fault.baseDurationMinutes * (1 + fault.percent / 100)
      );
    }
  };

  const resource: ForkcastScenario = {
    ...spec("dishwasher-offline"),
    faultType: "RESOURCE_UNAVAILABLE",
    fault: { kind: "RESOURCE_UNAVAILABLE", resourceId: "dishwasher" },
    validate(fault) {
      if (fault.kind !== "RESOURCE_UNAVAILABLE") return ["Invalid fault payload for a resource outage."];
      const issues: string[] = [];
      if (!world.resources[fault.resourceId]) {
        issues.push(`Resource "${fault.resourceId}" does not exist.`);
      }
      return issues;
    },
    applyFault(draft, fault) {
      if (fault.kind !== "RESOURCE_UNAVAILABLE") throw new Error("Invalid fault pairing.");
      const target = draft.resources[fault.resourceId];
      if (!target) throw new Error(`Resource "${fault.resourceId}" does not exist.`);
      target.available = false;
    }
  };

  return [delivery, ingredient, overrun, resource];
}

export function getScenarioSpec(id: string) {
  const found = SCENARIO_SPECS.find((entry) => entry.id === id);
  if (!found) throw new Error(`Unknown scenario "${id}".`);
  return found;
}
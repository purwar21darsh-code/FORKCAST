import type { ActionPlan, MealOption, PlanTask, WorldState } from "./types.js";

export type TaskOrderProfile = "balanced" | "meal-first" | "setup-first" | "clean-first";

export const TASK_ORDER_PROFILES: TaskOrderProfile[] = [
  "balanced",
  "meal-first",
  "setup-first",
  "clean-first"
];

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function getMeal(world: WorldState, mealId: string): MealOption {
  const meal = world.meals.find((candidate) => candidate.id === mealId);
  if (!meal) throw new Error(`Unknown meal "${mealId}".`);
  return meal;
}

export function allTaskDefinitions(world: WorldState): PlanTask[] {
  return [...world.baseTasks, ...world.meals.flatMap((meal) => meal.tasks)];
}

export function findTaskDefinition(world: WorldState, taskId: string): PlanTask | undefined {
  return allTaskDefinitions(world).find((task) => task.id === taskId);
}

function reorderTasks(tasks: PlanTask[], profile: TaskOrderProfile): PlanTask[] {
  const copy = structuredClone(tasks);
  if (profile === "balanced") return copy;

  const key = (task: PlanTask): number => {
    if (profile === "meal-first") {
      if (task.phase === "meal") return 0;
      if (task.phase === "check") return 2;
      return 1;
    }
    if (profile === "setup-first") {
      if (task.phase === "setup") return 0;
      if (task.phase === "meal") return 1;
      if (task.phase === "service") return 2;
      return 3;
    }
    // clean-first: clear the dining room and table before the cooking area.
    const rank: Record<string, number> = {
      clean_dining: 0,
      set_table: 1,
      clean_kitchen: 2,
      inventory_check: 3,
      prep_vegetables: 4,
      cook_rice: 5
    };
    return rank[task.id] ?? 6;
  };

  return copy
    .map((task, index) => ({ task, index, rank: key(task) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.task);
}

export function buildPlan(
  world: WorldState,
  mealId: string,
  request: string,
  origin: "baseline" | "repair",
  profile: TaskOrderProfile = "balanced"
): ActionPlan {
  const meal = getMeal(world, mealId);
  const tasks = reorderTasks([...world.baseTasks, ...meal.tasks], profile);
  const taskOrder = tasks.map((task) => task.id).join(",");
  const normalizedRequest = request.trim().slice(0, 280);
  const id = [
    "plan",
    origin,
    meal.id,
    String(world.revision),
    profile,
    fnv1a(normalizedRequest + "|" + taskOrder)
  ].join("-");

  return {
    id,
    seedId: world.seedId,
    worldRevision: world.revision,
    request: normalizedRequest,
    mealId: meal.id,
    mealName: meal.name,
    tasks,
    origin
  };
}

export function buildDefaultPlan(world: WorldState, request: string): ActionPlan {
  const defaultMeal = world.meals.find((meal) => meal.isDefault) ?? world.meals[0];
  if (!defaultMeal) throw new Error("The seeded world has no meal options.");
  return buildPlan(world, defaultMeal.id, request, "baseline", "balanced");
}

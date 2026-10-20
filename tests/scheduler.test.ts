import { describe, expect, it } from "vitest";
import { createSeedWorld } from "../src/domain/seed.js";
import { buildDefaultPlan, buildPlan } from "../src/domain/plan.js";
import { schedulePlan } from "../src/engine/schedule.js";
import type { ActionPlan, PlanTask } from "../src/domain/types.js";

function fixture() {
  const world = createSeedWorld();
  const plan = buildDefaultPlan(world, world.requestExample);
  return { world, plan };
}

function dependencyOrderingHolds(schedule: ReturnType<typeof schedulePlan>): boolean {
  const byId = new Map(schedule.tasks.map((task) => [task.taskId, task]));
  for (const task of schedule.tasks) {
    if (task.status !== "scheduled") continue;
    for (const dependency of task.dependsOn) {
      const parent = byId.get(dependency);
      if (!parent || parent.status !== "scheduled") return false;
      if (task.startMinute === null || parent.endMinute === null) return false;
      if (task.startMinute < parent.endMinute) return false;
    }
  }
  return true;
}

describe("deterministic scheduler", () => {
  it("calculates a feasible seeded baseline at 5:35 PM with 25 minutes of slack", () => {
    const { world, plan } = fixture();
    const schedule = schedulePlan(world, plan);
    expect(schedule.feasible).toBe(true);
    expect(schedule.completionMinute).toBe(1055);
    expect(schedule.slackMinutes).toBe(25);
    expect(schedule.violations.filter((entry) => entry.severity === "error")).toEqual([]);
    expect(schedule.tasks.every((task) => task.status === "scheduled")).toBe(true);
    expect(dependencyOrderingHolds(schedule)).toBe(true);
  });

  it("does not mutate the input world or plan", () => {
    const { world, plan } = fixture();
    const worldBefore = JSON.stringify(world);
    const planBefore = JSON.stringify(plan);
    schedulePlan(world, plan);
    expect(JSON.stringify(world)).toBe(worldBefore);
    expect(JSON.stringify(plan)).toBe(planBefore);
  });

  it("is repeatable", () => {
    const { world, plan } = fixture();
    expect(schedulePlan(world, plan)).toEqual(schedulePlan(world, plan));
  });

  it("enforces resource capacity: no two capacity-1 tasks overlap on a resource", () => {
    const { world, plan } = fixture();
    const schedule = schedulePlan(world, plan);
    for (const [resourceId, resource] of Object.entries(world.resources)) {
      const intervals = schedule.resourceIntervals.filter(
        (entry) => entry.resourceId === resourceId
      );
      for (let index = 0; index < intervals.length; index += 1) {
        for (let other = index + 1; other < intervals.length; other += 1) {
          const a = intervals[index]!;
          const b = intervals[other]!;
          if (resource.capacity === 1) {
            expect(a.startMinute < b.endMinute && b.startMinute < a.endMinute).toBe(false);
          }
        }
      }
    }
  });

  it("detects a dependency cycle and refuses to claim feasibility", () => {
    const { world, plan } = fixture();
    const broken: ActionPlan = structuredClone(plan);
    const inventory = broken.tasks.find((task) => task.id === "inventory_check");
    if (!inventory) throw new Error("fixture missing inventory task");
    inventory.dependsOn = ["primary_final_check"];
    const schedule = schedulePlan(world, broken);
    expect(schedule.feasible).toBe(false);
    expect(schedule.violations.some((entry) => entry.code === "DEPENDENCY_CYCLE")).toBe(true);
    expect(schedule.completionMinute).toBeNull();
  });

  it("rejects invalid durations and duplicate task ids", () => {
    const { world, plan } = fixture();
    const badDuration = structuredClone(plan);
    const first = badDuration.tasks[0];
    if (!first) throw new Error("fixture missing task");
    first.durationMinutes = 0;
    expect(
      schedulePlan(world, badDuration).violations.some((entry) => entry.code === "INVALID_DURATION")
    ).toBe(true);

    const duplicate = structuredClone(plan);
    const duplicateTask: PlanTask = structuredClone(plan.tasks[0]!);
    duplicate.tasks.push(duplicateTask);
    expect(
      schedulePlan(world, duplicate).violations.some((entry) => entry.code === "DUPLICATE_TASK")
    ).toBe(true);
  });

  it("reports a missed guest deadline as a hard violation", () => {
    const { world, plan } = fixture();
    world.arrivalDeadlineMinute = 1000;
    const schedule = schedulePlan(world, plan);
    expect(schedule.feasible).toBe(false);
    expect(schedule.violations.some((entry) => entry.code === "DEADLINE_MISSED")).toBe(true);
  });

  it("reports missing and insufficient ingredients", () => {
    const { world, plan } = fixture();
    delete world.inventory.chicken;
    const schedule = schedulePlan(world, plan);
    expect(schedule.feasible).toBe(false);
    expect(
      schedule.violations.some(
        (entry) => entry.code === "MISSING_INGREDIENT" && entry.ingredientId === "chicken"
      )
    ).toBe(true);
  });

  it("applies ingredient availability windows", () => {
    const { world, plan } = fixture();
    world.inventory.chicken!.availableAtMinute = 960;
    world.deliveries[0]!.availableAtMinute = 960;
    const schedule = schedulePlan(world, plan);
    expect(schedule.feasible).toBe(false);
    expect(schedule.completionMinute).toBe(1085);
    expect(schedule.violations.some((entry) => entry.code === "DEADLINE_MISSED")).toBe(true);
  });

  it("applies a task duration override", () => {
    const { world, plan } = fixture();
    world.taskDurationOverrides.primary_roast = 105;
    const schedule = schedulePlan(world, plan);
    expect(schedule.feasible).toBe(false);
    expect(schedule.completionMinute).toBe(1090);
  });

  it("omits only an optional task when its resource is unavailable", () => {
    const { world, plan } = fixture();
    world.resources.dishwasher!.available = false;
    const schedule = schedulePlan(world, plan);
    expect(schedule.feasible).toBe(true);
    const rinse = schedule.tasks.find((task) => task.taskId === "rinse_service");
    expect(rinse?.status).toBe("skipped");
    expect(rinse?.optional).toBe(true);
    expect(schedule.completionMinute).toBe(1055);
    expect(
      schedule.violations.some(
        (entry) => entry.code === "RESOURCE_UNAVAILABLE" && entry.severity === "warning"
      )
    ).toBe(true);
  });

  it("schedules the defined alternate meal earlier and without the oven", () => {
    const { world } = fixture();
    const alternate = buildPlan(world, "paneer-curry", world.requestExample, "repair");
    const schedule = schedulePlan(world, alternate);
    expect(schedule.feasible).toBe(true);
    expect(schedule.completionMinute).toBe(1052);
    expect(schedule.resourceIntervals.some((entry) => entry.resourceId === "oven")).toBe(false);
    expect(schedule.tasks.every((task) => task.status === "scheduled")).toBe(true);
  });

  it("falls back to a declared alternate resource when one is available", () => {
    const { world, plan } = fixture();
    world.resources.oven!.available = false;
    const schedule = schedulePlan(world, plan);
    const roast = schedule.tasks.find((task) => task.taskId === "primary_roast");
    expect(roast?.status).toBe("scheduled");
    expect(roast?.resourcesAssigned).toEqual(["countertop_oven"]);
    expect(schedule.feasible).toBe(true);
  });
});

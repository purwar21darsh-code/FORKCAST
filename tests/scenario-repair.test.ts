import { describe, expect, it } from "vitest";
import { createSeedWorld } from "../src/domain/seed.js";
import { buildDefaultPlan } from "../src/domain/plan.js";
import { simulateScenario } from "../src/engine/scenario-runner.js";
import { repairPlan } from "../src/engine/repair.js";
import { schedulePlan } from "../src/engine/schedule.js";

function fixture() {
  const world = createSeedWorld();
  const plan = buildDefaultPlan(world, world.requestExample);
  return { world, plan };
}

describe("scenario simulation and repair", () => {
  it("calculates the delivery delay as a 30-minute slip that breaks the deadline", () => {
    const { world, plan } = fixture();
    const before = JSON.stringify(world);
    const analysis = simulateScenario(world, plan, "delivery-delay");
    expect(JSON.stringify(world)).toBe(before);
    expect(analysis.baseline.schedule.feasible).toBe(true);
    expect(analysis.faulted.schedule.feasible).toBe(false);
    expect(analysis.faulted.schedule.completionMinute).toBe(1085);
    expect(analysis.comparison.verdict).toBe("failed");
    expect(analysis.comparison.faultedDeadlineMet).toBe(false);
    expect(analysis.comparison.completionDeltaMinutes).toBe(30);
    expect(analysis.comparison.affectedTasks.length).toBeGreaterThan(0);
    expect(analysis.comparison.newlyViolatedConstraints.join(" ")).toContain("deadline");
  });

  it("calculates a missing chicken as an actual missing-ingredient violation", () => {
    const { world, plan } = fixture();
    const analysis = simulateScenario(world, plan, "chicken-unavailable");
    expect(analysis.faulted.schedule.feasible).toBe(false);
    expect(analysis.comparison.missingIngredientIds).toContain("chicken");
    expect(analysis.comparison.newlyViolatedConstraints.length).toBeGreaterThan(0);
    expect(analysis.comparison.verdict).toBe("failed");
  });

  it("calculates the task overrun with ceil rounding", () => {
    const { world, plan } = fixture();
    const analysis = simulateScenario(world, plan, "roast-overrun");
    expect(analysis.faulted.world.taskDurationOverrides.primary_roast).toBe(105);
    expect(analysis.faulted.schedule.completionMinute).toBe(1090);
    expect(analysis.comparison.verdict).toBe("failed");
  });

  it("keeps mandatory dinner constraints when an optional resource disappears", () => {
    const { world, plan } = fixture();
    const analysis = simulateScenario(world, plan, "dishwasher-offline");
    expect(analysis.faulted.schedule.feasible).toBe(true);
    expect(analysis.comparison.verdict).toBe("passed-with-degradation");
    expect(analysis.comparison.skippedOptionalTaskIds).toContain("rinse_service");
    expect(analysis.comparison.unavailableResourceIds).toContain("dishwasher");
    expect(analysis.faulted.schedule.completionMinute).toBe(1055);
  });

  it("isolates each fault: a scenario world never changes the baseline world", () => {
    const { world, plan } = fixture();
    const delivery = simulateScenario(world, plan, "delivery-delay");
    const chicken = simulateScenario(world, plan, "chicken-unavailable");
    expect(delivery.faulted.world.inventory.chicken?.availableAtMinute).toBe(960);
    expect(chicken.faulted.world.inventory.chicken).toBeUndefined();
    expect(world.inventory.chicken?.availableAtMinute).toBe(930);
  });

  it("verifies a real delivery-delay repair and does not relax a hard constraint", () => {
    const { world, plan } = fixture();
    const analysis = simulateScenario(world, plan, "delivery-delay");
    const faultedBefore = JSON.stringify(analysis.faulted.world);
    const repair = repairPlan(analysis.faulted.world, plan, analysis.faulted.schedule);
    expect(JSON.stringify(analysis.faulted.world)).toBe(faultedBefore);
    expect(repair.status).toBe("feasible");
    expect(repair.constraintsRelaxed).toBe(false);
    expect(repair.verification?.verified).toBe(true);
    expect(repair.verification?.feasible).toBe(true);
    expect(repair.repairedPlan?.mealId).toBe("paneer-curry");
    expect(repair.repairedSchedule?.feasible).toBe(true);
    expect(repair.repairedSchedule?.completionMinute).toBe(1052);
    expect(repair.repairedSchedule?.completionMinute).toBeLessThanOrEqual(
      repair.repairedSchedule?.deadlineMinute ?? 0
    );
    expect(repair.diff?.mealChanged).toBe(true);
    expect(repair.diff?.addedTasks.length).toBeGreaterThan(0);
    expect(repair.diff?.removedTasks.length).toBeGreaterThan(0);
    expect(repair.search.evaluated).toBe(8);
    expect(repair.search.limit).toBe(24);
  });

  it("finds a verified repair after chicken becomes unavailable", () => {
    const { world, plan } = fixture();
    const analysis = simulateScenario(world, plan, "chicken-unavailable");
    const repair = repairPlan(analysis.faulted.world, plan, analysis.faulted.schedule);
    expect(repair.status).toBe("feasible");
    expect(repair.verification?.verified).toBe(true);
    expect(repair.repairedSchedule?.feasible).toBe(true);
  });

  it("finds a verified repair after the roast overruns", () => {
    const { world, plan } = fixture();
    const analysis = simulateScenario(world, plan, "roast-overrun");
    const repair = repairPlan(analysis.faulted.world, plan, analysis.faulted.schedule);
    expect(repair.status).toBe("feasible");
    expect(repair.verification?.verified).toBe(true);
  });

  it("returns not-needed when the faulted schedule is already feasible", () => {
    const { world, plan } = fixture();
    const analysis = simulateScenario(world, plan, "dishwasher-offline");
    const repair = repairPlan(analysis.faulted.world, plan, analysis.faulted.schedule);
    expect(repair.status).toBe("not-needed");
    expect(repair.repairedPlan).toBeNull();
    expect(repair.verification?.verified).toBe(true);
    expect(repair.search.evaluated).toBe(0);
  });

  it("reports no-feasible-repair instead of inventing a plan", () => {
    const { world, plan } = fixture();
    const analysis = simulateScenario(world, plan, "chicken-unavailable");
    delete analysis.faulted.world.inventory.paneer;
    const repair = repairPlan(analysis.faulted.world, plan, analysis.faulted.schedule);
    expect(repair.status).toBe("no-feasible-repair");
    expect(repair.repairedPlan).toBeNull();
    expect(repair.verification).toBeNull();
    expect(repair.constraintsRelaxed).toBe(false);
    expect(repair.explanation).toContain("No defined meal");
  });

  it("treats an already feasible schedule as not requiring repair at the lower level", () => {
    const { world, plan } = fixture();
    const schedule = schedulePlan(world, plan);
    const repair = repairPlan(world, plan, schedule);
    expect(repair.status).toBe("not-needed");
  });
});

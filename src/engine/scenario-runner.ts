import { runScenarioMatrix, type SimulationReport } from "faultline-sim";
import type { ActionPlan, SimulationOutcome, WorldState } from "../domain/types.js";
import { evaluateSchedule, schedulePlan } from "./schedule.js";
import { compareSchedules, type ScenarioComparison, type Snapshot } from "./compare.js";
import { createForkcastScenarios, getScenarioSpec, type ForkcastFault } from "./scenarios.js";

export interface ScenarioAnalysis {
  scenarioId: string;
  scenarioName: string;
  baseline: Snapshot;
  faulted: Snapshot;
  baselineOutcome: SimulationOutcome;
  faultedOutcome: SimulationOutcome;
  comparison: ScenarioComparison;
  report: SimulationReport<WorldState, ActionPlan, Snapshot>;
}

export function simulateScenario(
  world: WorldState,
  plan: ActionPlan,
  scenarioId: string
): ScenarioAnalysis {
  const scenarios = createForkcastScenarios(world);
  const scenario = scenarios.find((entry) => entry.id === scenarioId);
  if (!scenario) throw new Error(`Unknown scenario "${scenarioId}".`);

  const report = runScenarioMatrix<WorldState, ActionPlan, Snapshot, ForkcastFault>({
    initialState: world,
    plan,
    scenarios: [scenario],
    cloneState: (state) => structuredClone(state),
    simulateInSandbox: (state, currentPlan) => {
      const schedule = schedulePlan(state, currentPlan);
      return { world: state, plan: currentPlan, schedule };
    },
    evaluateOutcome: (result) => {
      const outcome = evaluateSchedule(result.world, result.plan, result.schedule);
      return {
        passed: outcome.feasible,
        summary: outcome.summary,
        violations: outcome.violations,
        metrics: outcome.metrics
      };
    }
  });

  const scenarioResult = report.scenarios[0];
  if (!scenarioResult) throw new Error("FAULTLINE returned no scenario result.");
  if (scenarioResult.status === "invalid" || scenarioResult.status === "error") {
    throw new Error(
      `Scenario "${scenarioId}" could not run: ` +
        (scenarioResult.issues?.join("; ") ?? scenarioResult.error?.message ?? "unknown error")
    );
  }
  if (!scenarioResult.result || !scenarioResult.state) {
    throw new Error(`Scenario "${scenarioId}" did not return a simulation snapshot.`);
  }

  const baseline = report.baseline.result;
  const faulted = scenarioResult.result;
  const comparison = compareSchedules(baseline, faulted);

  return {
    scenarioId,
    scenarioName: scenario.name,
    baseline,
    faulted,
    baselineOutcome: evaluateSchedule(baseline.world, baseline.plan, baseline.schedule),
    faultedOutcome: evaluateSchedule(faulted.world, faulted.plan, faulted.schedule),
    comparison,
    report
  };
}

export function simulateAllScenarios(
  world: WorldState,
  plan: ActionPlan,
  scenarioIds?: string[]
): ScenarioAnalysis[] {
  const ids = scenarioIds ?? getScenarioIds();
  return ids.map((id) => simulateScenario(world, plan, id));
}

export function getScenarioIds(): string[] {
  return [
    "delivery-delay",
    "chicken-unavailable",
    "roast-overrun",
    "dishwasher-offline"
  ];
}

export { getScenarioSpec };
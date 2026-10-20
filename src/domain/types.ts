/**
 * FORKCAST's deterministic world model.
 *
 * Time is always an integer number of minutes after local midnight.
 * A scheduled interval is half-open: [startMinute, endMinute).
 * The fixed seed date is display metadata only; the engine does not read the
 * machine clock when scheduling.
 */

export type Minutes = number;

export type TaskPhase = "setup" | "meal" | "service" | "check";
export type TaskStatus = "scheduled" | "skipped" | "unschedulable";
export type ViolationSeverity = "error" | "warning";
export type ViolationCode =
  | "INVALID_TASK"
  | "DUPLICATE_TASK"
  | "INVALID_DURATION"
  | "UNKNOWN_DEPENDENCY"
  | "DEPENDENCY_CYCLE"
  | "DEPENDENCY_UNSCHEDULED"
  | "UNKNOWN_RESOURCE"
  | "RESOURCE_UNAVAILABLE"
  | "UNKNOWN_INGREDIENT"
  | "MISSING_INGREDIENT"
  | "INSUFFICIENT_INGREDIENT"
  | "DEADLINE_MISSED"
  | "TASK_UNSCHEDULED";

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  /** Total quantity available in this simulated household. */
  quantity: number;
  /** Earliest minute at which this quantity can be used. */
  availableAtMinute: Minutes;
  deliveryId: string | null;
  category: "protein" | "produce" | "dairy" | "pantry" | "bakery";
}

export interface Delivery {
  id: string;
  name: string;
  availableAtMinute: Minutes;
  ingredientIds: string[];
}

export interface Resource {
  id: string;
  name: string;
  capacity: number;
  available: boolean;
}

export interface IngredientRequirement {
  ingredientId: string;
  quantity: number;
}

export interface PlanTask {
  id: string;
  name: string;
  durationMinutes: number;
  /** Earliest local minute at which the task may start (optional service window). */
  notBeforeMinute?: Minutes;
  dependsOn: string[];
  resources: string[];
  /**
   * Optional fallback resources keyed by the primary resource id.
   * Example: { oven: ["countertop_oven"] }.
   */
  resourceAlternatives?: Record<string, string[]>;
  ingredients: IngredientRequirement[];
  optional: boolean;
  phase: TaskPhase;
}

export interface MealOption {
  id: string;
  name: string;
  description: string;
  dietaryTags: string[];
  isDefault: boolean;
  terminalTaskId: string;
  tasks: PlanTask[];
}

export interface ExecutionRecord {
  planId: string;
  mealId: string;
  mealName: string;
  appliedAtIso: string;
  completionMinute: Minutes;
  taskCount: number;
  ingredientConsumption: {
    ingredientId: string;
    name: string;
    quantity: number;
    unit: string;
  }[];
  note: string;
}

export interface WorldState {
  schemaVersion: 1;
  seedId: string;
  revision: number;
  demoDateLabel: string;
  requestExample: string;
  householdName: string;
  guestCount: number;
  dayStartMinute: Minutes;
  arrivalDeadlineMinute: Minutes;
  inventory: Record<string, Ingredient>;
  deliveries: Delivery[];
  resources: Record<string, Resource>;
  baseTasks: PlanTask[];
  meals: MealOption[];
  /**
   * Scenario-local duration overlays. Fault injection mutates this field only
   * on an isolated world copy. The immutable scheduler reads it as an overlay.
   */
  taskDurationOverrides: Record<string, number>;
  appliedExecution: ExecutionRecord | null;
}

export interface ActionPlan {
  id: string;
  seedId: string;
  worldRevision: number;
  request: string;
  mealId: string;
  mealName: string;
  tasks: PlanTask[];
  origin: "baseline" | "repair";
}

export interface ConstraintViolation {
  code: ViolationCode;
  severity: ViolationSeverity;
  message: string;
  taskId?: string;
  resourceId?: string;
  ingredientId?: string;
}

export interface ScheduledTask {
  taskId: string;
  name: string;
  phase: TaskPhase;
  optional: boolean;
  status: TaskStatus;
  startMinute: Minutes | null;
  endMinute: Minutes | null;
  durationMinutes: number;
  dependsOn: string[];
  resourcesRequired: string[];
  resourcesAssigned: string[];
  ingredients: IngredientRequirement[];
  slackMinutes: Minutes | null;
  reason: string | null;
}

export interface ResourceInterval {
  resourceId: string;
  taskId: string;
  startMinute: Minutes;
  endMinute: Minutes;
}

export interface ScheduleEvidence {
  algorithm: "deterministic-resource-aware-greedy-v1";
  taskOrderRule: string;
  tieBreakRule: string;
  resourceRule: string;
  candidateEvaluations: number;
  resourceWaitCount: number;
  ingredientWaitCount: number;
  selectedTaskOrder: string[];
  notes: string[];
}

export interface ScheduleResult {
  planId: string;
  mealId: string;
  worldRevision: number;
  feasible: boolean;
  deadlineMinute: Minutes;
  completionMinute: Minutes | null;
  slackMinutes: Minutes | null;
  tasks: ScheduledTask[];
  violations: ConstraintViolation[];
  resourceIntervals: ResourceInterval[];
  evidence: ScheduleEvidence;
}

export interface SimulationOutcome {
  feasible: boolean;
  summary: string;
  violations: string[];
  metrics: {
    completionMinute: number | null;
    slackMinutes: number | null;
    scheduledTasks: number;
    unscheduledMandatoryTasks: number;
    skippedOptionalTasks: number;
  };
}

export interface ScenarioSpec {
  id: string;
  name: string;
  description: string;
  faultType: "DELIVERY_DELAY" | "INGREDIENT_UNAVAILABLE" | "TASK_OVERRUN" | "RESOURCE_UNAVAILABLE";
  severity: "warning" | "critical";
  parameters: Record<string, string | number>;
  affectedStateFields: string[];
}
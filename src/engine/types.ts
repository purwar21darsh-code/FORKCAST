// FORKCAST Core Engine Types
// Deterministic world model for counterfactual planning

export interface Ingredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  availableAt: number; // minutes from start (0 = immediately available)
  category: 'protein' | 'carb' | 'vegetable' | 'dairy' | 'spice' | 'other';
}

export interface Inventory {
  ingredients: Record<string, Ingredient>;
}

export interface Resource {
  id: string;
  name: string;
  available: boolean;
  capacity: number; // concurrent uses allowed
}

export interface TaskDependency {
  taskId: string;
  type: 'finish-start' | 'start-start';
  lagMinutes: number;
}

export interface PlanTask {
  id: string;
  name: string;
  duration: number; // minutes
  dependencies: TaskDependency[];
  requiredResources: string[];
  requiredIngredients: { ingredientId: string; quantity: number }[];
  startTime?: number;
  finishTime?: number;
  slack?: number;
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'blocked';
  criticalPath: boolean;
}

export interface MealOption {
  id: string;
  name: string;
  description: string;
  requiredTasks: string[];
  requiredIngredients: { ingredientId: string; quantity: number }[];
}

export interface WorldState {
  id: string;
  seed: number;
  timestamp: number; // simulated time reference
  deadline: number; // minutes from start (e.g., 360 = 6 hours = 18:00)
  currentTime: number; // current simulated time in minutes
  inventory: Inventory;
  resources: Resource[];
  tasks: PlanTask[];
  mealOptions: MealOption[];
  selectedMeal: string;
  version: number;
}

export interface FaultScenario {
  id: string;
  name: string;
  type: 'DELIVERY_DELAY' | 'INGREDIENT_UNAVAILABLE' | 'TASK_OVERRUN' | 'RESOURCE_UNAVAILABLE';
  description: string;
  targetId: string; // task ID, ingredient ID, or resource ID
  parameter: number; // delay minutes, duration multiplier, etc.
  applied: boolean;
}

export interface ConstraintViolation {
  type: 'DEADLINE' | 'MISSING_INGREDIENT' | 'RESOURCE_CONFLICT' | 'DEPENDENCY_CYCLE' | 'TASK_OVERRUN';
  taskId?: string;
  description: string;
  severity: 'warning' | 'critical' | 'fatal';
  details: string;
}

export interface SimulationOutcome {
  scenarioId: string;
  feasible: boolean;
  completionTime: number;
  lateness: number; // minutes past deadline (negative = early)
  violations: ConstraintViolation[];
  affectedTasks: string[];
  taskResults: { taskId: string; startTime: number; finishTime: number; status: string }[];
  explanation: string;
}

export interface RepairedPlan {
  originalScenarioId: string;
  repairId: string;
  changes: { type: string; description: string; details: string }[];
  newTasks: PlanTask[];
  feasible: boolean;
  completionTime: number;
  lateness: number;
  violations: ConstraintViolation[];
  tradeOffs: string[];
  explanation: string;
}

export interface ComparisonResult {
  baseline: SimulationOutcome;
  scenarios: { scenario: FaultScenario; outcome: SimulationOutcome; repair?: RepairedPlan }[];
  summary: string;
}

export interface ActivityLogEntry {
  id: string;
  timestamp: number;
  action: string;
  details: string;
  status: 'success' | 'warning' | 'error' | 'info';
}

export interface MCPToolResult {
  success: boolean;
  data?: any;
  error?: string;
  toolName: string;
}

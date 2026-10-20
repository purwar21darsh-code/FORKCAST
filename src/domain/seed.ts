import type {
  Ingredient,
  MealOption,
  PlanTask,
  Resource,
  ScenarioSpec,
  WorldState
} from "./types.js";

const inventory: Record<string, Ingredient> = {
  chicken: {
    id: "chicken",
    name: "Free-range chicken",
    unit: "kg",
    quantity: 1.8,
    availableAtMinute: 930,
    deliveryId: "chilled_delivery",
    category: "protein"
  },
  butter: {
    id: "butter",
    name: "Cultured butter",
    unit: "kg",
    quantity: 0.5,
    availableAtMinute: 930,
    deliveryId: "chilled_delivery",
    category: "dairy"
  },
  mixed_vegetables: {
    id: "mixed_vegetables",
    name: "Seasonal vegetables",
    unit: "kg",
    quantity: 1.2,
    availableAtMinute: 540,
    deliveryId: null,
    category: "produce"
  },
  rice: {
    id: "rice",
    name: "Basmati rice",
    unit: "kg",
    quantity: 1.2,
    availableAtMinute: 540,
    deliveryId: null,
    category: "pantry"
  },
  paneer: {
    id: "paneer",
    name: "Paneer",
    unit: "kg",
    quantity: 0.7,
    availableAtMinute: 540,
    deliveryId: null,
    category: "dairy"
  },
  tomatoes: {
    id: "tomatoes",
    name: "Ripe tomatoes",
    unit: "kg",
    quantity: 1,
    availableAtMinute: 540,
    deliveryId: null,
    category: "produce"
  },
  cream: {
    id: "cream",
    name: "Cooking cream",
    unit: "L",
    quantity: 0.4,
    availableAtMinute: 540,
    deliveryId: null,
    category: "dairy"
  },
  cooking_oil: {
    id: "cooking_oil",
    name: "Cooking oil",
    unit: "L",
    quantity: 0.5,
    availableAtMinute: 540,
    deliveryId: null,
    category: "pantry"
  }
};

const resources: Record<string, Resource> = {
  prep_counter: { id: "prep_counter", name: "Prep counter", capacity: 1, available: true },
  oven: { id: "oven", name: "Main oven", capacity: 1, available: true },
  countertop_oven: {
    id: "countertop_oven",
    name: "Countertop oven",
    capacity: 1,
    available: true
  },
  stove: { id: "stove", name: "Stove", capacity: 1, available: true },
  dining_room: { id: "dining_room", name: "Dining room", capacity: 1, available: true },
  kitchen: { id: "kitchen", name: "Kitchen floor", capacity: 1, available: true },
  dishwasher: { id: "dishwasher", name: "Dishwasher", capacity: 1, available: true }
};

const baseTasks: PlanTask[] = [
  {
    id: "inventory_check",
    name: "Check inventory and deliveries",
    durationMinutes: 10,
    dependsOn: [],
    resources: ["prep_counter"],
    ingredients: [],
    optional: false,
    phase: "setup"
  },
  {
    id: "prep_vegetables",
    name: "Wash and prep vegetables",
    durationMinutes: 30,
    dependsOn: ["inventory_check"],
    resources: ["prep_counter"],
    ingredients: [{ ingredientId: "mixed_vegetables", quantity: 0.8 }],
    optional: false,
    phase: "meal"
  },
  {
    id: "cook_rice",
    name: "Cook rice",
    durationMinutes: 25,
    dependsOn: ["inventory_check"],
    resources: ["stove"],
    ingredients: [{ ingredientId: "rice", quantity: 0.7 }],
    optional: false,
    phase: "meal"
  },
  {
    id: "clean_dining",
    name: "Clean dining room",
    durationMinutes: 30,
    dependsOn: [],
    resources: ["dining_room"],
    ingredients: [],
    optional: false,
    phase: "setup"
  },
  {
    id: "clean_kitchen",
    name: "Reset kitchen surfaces",
    durationMinutes: 20,
    dependsOn: [],
    resources: ["kitchen"],
    ingredients: [],
    optional: false,
    phase: "setup"
  },
  {
    id: "set_table",
    name: "Set the table for six",
    durationMinutes: 15,
    dependsOn: ["clean_dining"],
    resources: ["dining_room"],
    ingredients: [],
    optional: false,
    phase: "service"
  },
  {
    id: "rinse_service",
    name: "Pre-rinse service dishes",
    durationMinutes: 15,
    dependsOn: ["set_table"],
    resources: ["dishwasher"],
    ingredients: [],
    optional: true,
    phase: "service"
  }
];

const roastChicken: MealOption = {
  id: "roast-chicken",
  name: "Herb roast chicken",
  description: "Roast chicken with rice and seasonal vegetables.",
  dietaryTags: ["contains dairy"],
  isDefault: true,
  terminalTaskId: "primary_final_check",
  tasks: [
    {
      id: "primary_marinate",
      name: "Marinate the chicken",
      durationMinutes: 15,
      dependsOn: ["inventory_check"],
      resources: ["prep_counter"],
      ingredients: [
        { ingredientId: "chicken", quantity: 1.5 },
        { ingredientId: "butter", quantity: 0.08 }
      ],
      optional: false,
      phase: "meal"
    },
    {
      id: "primary_roast",
      name: "Roast chicken",
      durationMinutes: 70,
      dependsOn: ["primary_marinate"],
      resources: ["oven"],
      resourceAlternatives: { oven: ["countertop_oven"] },
      ingredients: [],
      optional: false,
      phase: "meal"
    },
    {
      id: "primary_rest",
      name: "Rest the roast",
      durationMinutes: 10,
      dependsOn: ["primary_roast"],
      resources: ["prep_counter"],
      ingredients: [],
      optional: false,
      phase: "meal"
    },
    {
      id: "primary_carve",
      name: "Carve the chicken",
      durationMinutes: 10,
      dependsOn: ["primary_rest"],
      resources: ["prep_counter"],
      ingredients: [],
      optional: false,
      phase: "meal"
    },
    {
      id: "primary_plate",
      name: "Plate the main course",
      durationMinutes: 10,
      dependsOn: ["primary_carve"],
      resources: ["prep_counter"],
      ingredients: [],
      optional: false,
      phase: "service"
    },
    {
      id: "primary_final_check",
      name: "Final table and timing check",
      durationMinutes: 10,
      dependsOn: ["primary_plate", "cook_rice", "prep_vegetables", "set_table"],
      resources: [],
      ingredients: [],
      optional: false,
      phase: "check"
    }
  ]
};

const paneerCurry: MealOption = {
  id: "paneer-curry",
  name: "Paneer tomato curry",
  description: "A faster pantry-based alternative with paneer, tomato and cream.",
  dietaryTags: ["vegetarian", "contains dairy"],
  isDefault: false,
  terminalTaskId: "alternate_final_check",
  tasks: [
    {
      id: "alternate_sear",
      name: "Sear paneer",
      durationMinutes: 12,
      notBeforeMinute: 990,
      dependsOn: ["inventory_check"],
      resources: ["prep_counter", "stove"],
      ingredients: [
        { ingredientId: "paneer", quantity: 0.5 },
        { ingredientId: "cooking_oil", quantity: 0.03 }
      ],
      optional: false,
      phase: "meal"
    },
    {
      id: "alternate_simmer",
      name: "Simmer tomato cream curry",
      durationMinutes: 30,
      dependsOn: ["alternate_sear"],
      resources: ["stove"],
      ingredients: [
        { ingredientId: "tomatoes", quantity: 0.6 },
        { ingredientId: "cream", quantity: 0.2 }
      ],
      optional: false,
      phase: "meal"
    },
    {
      id: "alternate_plate",
      name: "Plate the curry",
      durationMinutes: 10,
      dependsOn: ["alternate_simmer"],
      resources: ["prep_counter"],
      ingredients: [],
      optional: false,
      phase: "service"
    },
    {
      id: "alternate_final_check",
      name: "Final table and timing check",
      durationMinutes: 10,
      dependsOn: ["alternate_plate", "cook_rice", "prep_vegetables", "set_table"],
      resources: [],
      ingredients: [],
      optional: false,
      phase: "check"
    }
  ]
};

export const SCENARIO_SPECS: ScenarioSpec[] = [
  {
    id: "delivery-delay",
    name: "Chilled delivery delayed 30 minutes",
    description:
      "The chilled delivery carrying chicken and butter arrives at 4:00 PM instead of 3:30 PM. Every affected ingredient availability shifts by 30 minutes.",
    faultType: "DELIVERY_DELAY",
    severity: "critical",
    parameters: { deliveryId: "chilled_delivery", minutes: 30, originalArrival: "3:30 PM" },
    affectedStateFields: ["deliveries[chilled_delivery].availableAtMinute", "inventory.*.availableAtMinute"]
  },
  {
    id: "chicken-unavailable",
    name: "Chicken unavailable",
    description:
      "The chicken is missing from the isolated inventory copy. The roast-chicken path cannot start.",
    faultType: "INGREDIENT_UNAVAILABLE",
    severity: "critical",
    parameters: { ingredientId: "chicken", name: "Free-range chicken" },
    affectedStateFields: ["inventory.chicken"]
  },
  {
    id: "roast-overrun",
    name: "Roast overruns by 50%",
    description:
      "The roast takes ceil(70 * 1.5) = 105 minutes instead of 70. Fractional minutes are rounded up.",
    faultType: "TASK_OVERRUN",
    severity: "critical",
    parameters: { taskId: "primary_roast", percent: 50, baseDurationMinutes: 70, overrunDurationMinutes: 105 },
    affectedStateFields: ["taskDurationOverrides.primary_roast"]
  },
  {
    id: "dishwasher-offline",
    name: "Dishwasher unavailable",
    description:
      "The optional pre-rinse resource is offline. The scheduler should omit only the optional task and keep mandatory dinner constraints intact.",
    faultType: "RESOURCE_UNAVAILABLE",
    severity: "warning",
    parameters: { resourceId: "dishwasher", optionalTaskId: "rinse_service" },
    affectedStateFields: ["resources.dishwasher.available"]
  }
];

export function createSeedWorld(): WorldState {
  return {
    schemaVersion: 1,
    seedId: "forkcast-six-guests-v1",
    revision: 1,
    demoDateLabel: "Saturday 14 November 2026 (fixed demo seed)",
    requestExample:
      "Prepare my home for six guests at 6 PM. Check inventory, build a schedule and test potential disruptions.",
    householdName: "The demo household",
    guestCount: 6,
    dayStartMinute: 540,
    arrivalDeadlineMinute: 1080,
    inventory: structuredClone(inventory),
    deliveries: [
      {
        id: "chilled_delivery",
        name: "Chilled grocery delivery",
        availableAtMinute: 930,
        ingredientIds: ["chicken", "butter"]
      }
    ],
    resources: structuredClone(resources),
    baseTasks: structuredClone(baseTasks),
    meals: [structuredClone(roastChicken), structuredClone(paneerCurry)],
    taskDurationOverrides: {},
    appliedExecution: null
  };
}

export function defaultWorld(): WorldState {
  return createSeedWorld();
}
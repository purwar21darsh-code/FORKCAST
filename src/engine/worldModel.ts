// FORKCAST Deterministic World Model
// Seeded household simulation for 6 guests at 6 PM

import type { WorldState, Ingredient, PlanTask, Resource, MealOption } from './types';

const SEED = 42;

function createIngredients(): Record<string, Ingredient> {
  return {
    'chicken-thighs': { id: 'chicken-thighs', name: 'Chicken Thighs', quantity: 1.5, unit: 'kg', availableAt: 0, category: 'protein' },
    'basmati-rice': { id: 'basmati-rice', name: 'Basmati Rice', quantity: 500, unit: 'g', availableAt: 0, category: 'carb' },
    'onions': { id: 'onions', name: 'Onions', quantity: 4, unit: 'pcs', availableAt: 0, category: 'vegetable' },
    'garlic': { id: 'garlic', name: 'Garlic', quantity: 6, unit: 'cloves', availableAt: 0, category: 'vegetable' },
    'ginger': { id: 'ginger', name: 'Fresh Ginger', quantity: 50, unit: 'g', availableAt: 0, category: 'spice' },
    'tomatoes': { id: 'tomatoes', name: 'Tomatoes', quantity: 6, unit: 'pcs', availableAt: 0, category: 'vegetable' },
    'yogurt': { id: 'yogurt', name: 'Plain Yogurt', quantity: 200, unit: 'ml', availableAt: 0, category: 'dairy' },
    'garam-masala': { id: 'garam-masala', name: 'Garam Masala', quantity: 30, unit: 'g', availableAt: 0, category: 'spice' },
    'turmeric': { id: 'turmeric', name: 'Turmeric', quantity: 15, unit: 'g', availableAt: 0, category: 'spice' },
    'cumin': { id: 'cumin', name: 'Cumin Seeds', quantity: 20, unit: 'g', availableAt: 0, category: 'spice' },
    'cream': { id: 'cream', name: 'Heavy Cream', quantity: 200, unit: 'ml', availableAt: 30, category: 'dairy' }, // Delivery delay scenario target
    'naan-bread': { id: 'naan-bread', name: 'Naan Bread', quantity: 12, unit: 'pcs', availableAt: 0, category: 'carb' },
    'cilantro': { id: 'cilantro', name: 'Fresh Cilantro', quantity: 1, unit: 'bunch', availableAt: 0, category: 'vegetable' },
    'lemon': { id: 'lemon', name: 'Lemons', quantity: 3, unit: 'pcs', availableAt: 0, category: 'vegetable' },
    'saffron': { id: 'saffron', name: 'Saffron Threads', quantity: 0.5, unit: 'g', availableAt: 0, category: 'spice' },
    // Alternative meal ingredients
    'pasta': { id: 'pasta', name: 'Penne Pasta', quantity: 500, unit: 'g', availableAt: 0, category: 'carb' },
    'pancetta': { id: 'pancetta', name: 'Pancetta', quantity: 200, unit: 'g', availableAt: 0, category: 'protein' },
    'eggs': { id: 'eggs', name: 'Eggs', quantity: 6, unit: 'pcs', availableAt: 0, category: 'protein' },
    'parmesan': { id: 'parmesan', name: 'Parmesan Cheese', quantity: 100, unit: 'g', availableAt: 0, category: 'dairy' },
    'black-pepper': { id: 'black-pepper', name: 'Black Pepper', quantity: 20, unit: 'g', availableAt: 0, category: 'spice' },
  };
}

function createResources(): Resource[] {
  return [
    { id: 'stove-burner-1', name: 'Stove Burner 1', available: true, capacity: 1 },
    { id: 'stove-burner-2', name: 'Stove Burner 2', available: true, capacity: 1 },
    { id: 'oven', name: 'Oven', available: true, capacity: 1 },
    { id: 'prep-counter', name: 'Prep Counter', available: true, capacity: 2 },
    { id: 'chef', name: 'Chef (You)', available: true, capacity: 1 },
  ];
}

function createTasks(): PlanTask[] {
  return [
    {
      id: 'prep-marinate',
      name: 'Prepare & Marinate Chicken',
      duration: 20,
      dependencies: [],
      requiredResources: ['prep-counter'],
      requiredIngredients: [
        { ingredientId: 'chicken-thighs', quantity: 1.5 },
        { ingredientId: 'yogurt', quantity: 150 },
        { ingredientId: 'garam-masala', quantity: 15 },
        { ingredientId: 'turmeric', quantity: 5 },
        { ingredientId: 'garlic', quantity: 4 },
        { ingredientId: 'ginger', quantity: 30 },
        { ingredientId: 'lemon', quantity: 1 },
      ],
      status: 'pending',
      criticalPath: false,
    },
    {
      id: 'cook-rice',
      name: 'Cook Basmati Rice',
      duration: 25,
      dependencies: [],
      requiredResources: ['stove-burner-1'],
      requiredIngredients: [
        { ingredientId: 'basmati-rice', quantity: 500 },
        { ingredientId: 'cumin', quantity: 5 },
        { ingredientId: 'saffron', quantity: 0.5 },
      ],
      status: 'pending',
      criticalPath: false,
    },
    {
      id: 'prep-vegetables',
      name: 'Chop Vegetables & Herbs',
      duration: 15,
      dependencies: [],
      requiredResources: ['prep-counter'],
      requiredIngredients: [
        { ingredientId: 'onions', quantity: 4 },
        { ingredientId: 'tomatoes', quantity: 6 },
        { ingredientId: 'garlic', quantity: 2 },
        { ingredientId: 'cilantro', quantity: 1 },
      ],
      status: 'pending',
      criticalPath: false,
    },
    {
      id: 'cook-curry',
      name: 'Cook Chicken Curry',
      duration: 45,
      dependencies: [
        { taskId: 'prep-marinate', type: 'finish-start', lagMinutes: 0 },
        { taskId: 'prep-vegetables', type: 'finish-start', lagMinutes: 0 },
      ],
      requiredResources: ['stove-burner-2'],
      requiredIngredients: [
        { ingredientId: 'onions', quantity: 3 },
        { ingredientId: 'tomatoes', quantity: 4 },
        { ingredientId: 'cream', quantity: 200 },
        { ingredientId: 'garam-masala', quantity: 15 },
      ],
      status: 'pending',
      criticalPath: true,
    },
    {
      id: 'warm-naan',
      name: 'Warm Naan Bread',
      duration: 10,
      dependencies: [
        { taskId: 'cook-curry', type: 'finish-start', lagMinutes: -10 }, // can start 10 min before curry done
      ],
      requiredResources: ['oven'],
      requiredIngredients: [
        { ingredientId: 'naan-bread', quantity: 12 },
      ],
      status: 'pending',
      criticalPath: false,
    },
    {
      id: 'prepare-raita',
      name: 'Prepare Raita',
      duration: 10,
      dependencies: [
        { taskId: 'prep-vegetables', type: 'finish-start', lagMinutes: 0 },
      ],
      requiredResources: ['prep-counter'],
      requiredIngredients: [
        { ingredientId: 'yogurt', quantity: 50 },
        { ingredientId: 'cilantro', quantity: 0.5 },
        { ingredientId: 'cumin', quantity: 3 },
      ],
      status: 'pending',
      criticalPath: false,
    },
    {
      id: 'final-plating',
      name: 'Final Plating & Garnish',
      duration: 15,
      dependencies: [
        { taskId: 'cook-curry', type: 'finish-start', lagMinutes: 0 },
        { taskId: 'cook-rice', type: 'finish-start', lagMinutes: 0 },
        { taskId: 'warm-naan', type: 'finish-start', lagMinutes: 0 },
        { taskId: 'prepare-raita', type: 'finish-start', lagMinutes: 0 },
      ],
      requiredResources: ['prep-counter'],
      requiredIngredients: [
        { ingredientId: 'cilantro', quantity: 0.5 },
        { ingredientId: 'lemon', quantity: 2 },
      ],
      status: 'pending',
      criticalPath: true,
    },
  ];
}

function createMealOptions(): MealOption[] {
  return [
    {
      id: 'chicken-curry-feast',
      name: 'Chicken Curry Feast',
      description: 'Aromatic chicken curry with basmati rice, naan, raita and fresh garnishes',
      requiredTasks: ['prep-marinate', 'cook-rice', 'prep-vegetables', 'cook-curry', 'warm-naan', 'prepare-raita', 'final-plating'],
      requiredIngredients: [
        { ingredientId: 'chicken-thighs', quantity: 1.5 },
        { ingredientId: 'basmati-rice', quantity: 500 },
        { ingredientId: 'cream', quantity: 200 },
        { ingredientId: 'naan-bread', quantity: 12 },
      ],
    },
    {
      id: 'pasta-carbonara',
      name: 'Pasta Carbonara',
      description: 'Classic Roman carbonara with pancetta, eggs, and parmesan — a valid alternative',
      requiredTasks: ['cook-pasta-alt', 'make-carbonara-alt', 'plate-alt'],
      requiredIngredients: [
        { ingredientId: 'pasta', quantity: 500 },
        { ingredientId: 'pancetta', quantity: 200 },
        { ingredientId: 'eggs', quantity: 6 },
        { ingredientId: 'parmesan', quantity: 100 },
      ],
    },
  ];
}

export function createSeedWorld(): WorldState {
  return {
    id: 'demo-world-001',
    seed: SEED,
    timestamp: 0,
    deadline: 360, // 6 hours = 18:00 (starting from 12:00)
    currentTime: 0,
    inventory: { ingredients: createIngredients() },
    resources: createResources(),
    tasks: createTasks(),
    mealOptions: createMealOptions(),
    selectedMeal: 'chicken-curry-feast',
    version: 1,
  };
}

export function cloneWorld(world: WorldState): WorldState {
  return JSON.parse(JSON.stringify(world));
}

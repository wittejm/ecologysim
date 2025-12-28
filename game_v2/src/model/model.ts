// Grid density - number of cells in each dimension
export const GRID_SIZE = 20;

// Ecosystem scale - multiplies all distances (spread, crowding, deer movement)
// 1.0 = normal, 2.0 = double size (trees farther apart), 0.5 = half size (denser)
const ECOSYSTEM_SCALE = 0.5;

// Tree Constants
const BASE_MAX_SIZE = 15;
const BASE_AGE_TO_SPREAD = 8;
const BASE_SPREAD_DISTANCE = 0.05 * ECOSYSTEM_SCALE;  // Scaled by ecosystem size
const BASE_DEATH_CHANCE = 0.018;  // Increased to control population
const MUTATION_RANGE = 0.05;

// Deer Constants
const BASE_DEER_SPEED = 0.008 * ECOSYSTEM_SCALE;         // Reduced from 0.03 - slower movement for localized dynamics
const BASE_DEER_DEATH_CHANCE = 0.00001;  // Base deer death chance (reduced to help early survival)
const BASE_DEER_MAX_EATABLE_SIZE = 3.5; // Base max tree size deer can eat (reduced so larger trees are safe)
export const BASE_DEER_REPRODUCE_CHANCE = 0.5; // Base chance of reproduction per tick when well-fed (tunable)
const DEER_CROWDING_RADIUS = 0.15 * ECOSYSTEM_SCALE; // How far deer sense crowding/disease
const DEER_CROWDING_DEATH_PENALTY = 0.002; // Death chance increase per nearby deer (tunable)
const DEER_FOOD_SEARCH_RADIUS = 0.08 * ECOSYSTEM_SCALE; // Reduced from 0.2 - limited vision/foraging range
const DEER_EATING_RADIUS = 0.03 * ECOSYSTEM_SCALE;      // Reduced from 0.05 - must be very close to eat

// Wolf Constants
const BASE_WOLF_SPEED = 0.015 * ECOSYSTEM_SCALE;        // Faster than deer (predator advantage)
const BASE_WOLF_DEATH_CHANCE = 0.00001;  // Base wolf death chance (very low - apex predator)
const BASE_WOLF_REPRODUCE_CHANCE = 0.18; // Base chance of reproduction per tick when well-fed
const WOLF_HUNT_RADIUS = 0.2 * ECOSYSTEM_SCALE; // How far wolves can detect prey
const WOLF_KILL_RADIUS = 0.035 * ECOSYSTEM_SCALE; // Must be close to kill
const WOLF_CROWDING_RADIUS = 0.3 * ECOSYSTEM_SCALE; // How far wolves sense crowding
const WOLF_CROWDING_DEATH_PENALTY = 0.006; // Death chance increase per nearby wolf - strong territorial pressure
const WOLF_STARVATION_PENALTY = 0.004; // Starvation penalty (reduced)

// Simulation Parameters (can be configured at runtime)
export type SimulationParams = {
  baseSpreadChance: number;
  baseCrowdedDeathChance: number;
  deerStarvationPenalty: number;
  deerReproduceAge: number;
};

// Default parameter values
export const DEFAULT_SIMULATION_PARAMS: SimulationParams = {
  baseSpreadChance: 0.10,
  baseCrowdedDeathChance: 0.50,  // Increased to control population
  deerStarvationPenalty: 0.003,
  deerReproduceAge: 10,
};

// ID Generator
class IdGenerator {
  private counter = 0;

  next(): number {
    return this.counter++;
  }
}

export const treeIdGenerator = new IdGenerator();
export const deerIdGenerator = new IdGenerator();
export const wolfIdGenerator = new IdGenerator();

// Types
export type TreeCharacteristics = {
  optimalMoisture: number;   // 0-1: The moisture level where this tree thrives best
  resilience: number;        // 0-1: Survival vs growth trade-off (high = survives better but grows slower)
  reproductionRate: number;  // 0-1: Reproduction speed and seed dispersal distance
};

export type DeerCharacteristics = {
  vitality: number;   // 0-1: Health, survival, and reproductive fitness
  speed: number;      // 0-1: Movement speed (helps find food but costs energy)
  appetite: number;   // 0-1: Eating capacity (affects hunger rate and max eatable tree size)
};

export type Tree = {
  id: number;
  x: number;
  y: number;
  age: number;
  size: number;
  characteristics: TreeCharacteristics;
};

export type Deer = {
  id: number;
  x: number;
  y: number;
  age: number;
  energy: number; // Tracks how well-fed the deer is
  characteristics: DeerCharacteristics;
};

export type WolfCharacteristics = {
  vitality: number;   // 0-1: Health, survival, and reproductive fitness
  speed: number;      // 0-1: Movement speed (helps find prey)
  hunting: number;    // 0-1: Hunting ability (affects success rate and detection range)
};

export type Wolf = {
  id: number;
  x: number;
  y: number;
  age: number;
  energy: number; // Tracks how well-fed the wolf is
  characteristics: WolfCharacteristics;
};

export type Ecosystem = {
  trees: Tree[];
  grid: Map<string, Tree[]>;
  deer: Deer[];
  wolves: Wolf[];
  terrain: number[][];  // GRID_SIZE x GRID_SIZE moisture grid (0-1)
  params: SimulationParams;  // Runtime-configurable parameters
};

// Utility functions
function mutate(): number {
  return (Math.random() - 0.5) * 2 * MUTATION_RANGE;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Get moisture level at a tree's location from terrain
function getMoisture(tree: Tree, ecosystem: Ecosystem): number {
  const gridX = Math.floor(tree.x * GRID_SIZE);
  const gridY = Math.floor(tree.y * GRID_SIZE);
  const clampedX = Math.max(0, Math.min(GRID_SIZE - 1, gridX));
  const clampedY = Math.max(0, Math.min(GRID_SIZE - 1, gridY));
  return ecosystem.terrain[clampedX][clampedY];
}

// Calculate how well moisture matches the tree's optimal moisture
// Resilience affects moisture tolerance: high resilience = generalist, low resilience = specialist
function getMoistureFitness(tree: Tree, ecosystem: Ecosystem): number {
  const moisture = getMoisture(tree, ecosystem);
  const distance = Math.abs(moisture - tree.characteristics.optimalMoisture);

  // Resilience determines moisture tolerance width
  // Low resilience (0.0) = narrow specialist (only thrive in perfect conditions)
  // High resilience (1.0) = wide generalist (tolerate range of conditions)
  const toleranceWidth = 0.3 + 0.7 * tree.characteristics.resilience;

  // Scale distance by tolerance - specialists are punished more for mismatch
  const scaledDistance = distance / toleranceWidth;

  // Fitness ranges from 0.05 (terrible mismatch) to 1.2 (perfect match for specialist)
  const baseFitness = Math.max(0.05, 1.0 - 0.95 * scaledDistance);

  // Specialists (low resilience) get big bonus for perfect match
  const specialistBonus = distance < 0.15 ? (1 - tree.characteristics.resilience) * 0.2 : 0;

  return baseFitness + specialistBonus;
}

// Property calculation functions based on characteristics
export function getMaxSize(tree: Tree, ecosystem?: Ecosystem): number {
  // Resilience: low resilience = faster growth to larger size (0.5 to 1.2 of base)
  // This creates r/K selection trade-off: fast-growing vs hardy
  const resilienceFactor = 1.2 - 0.7 * tree.characteristics.resilience;

  // Reproduction Rate: energy cost reduces max size slightly (0.85 to 1.0)
  const reproductionPenalty = 1 - 0.15 * tree.characteristics.reproductionRate;

  // Moisture fitness: affects max size (0.5x to 1.0x)
  const moistureFactor = ecosystem ? 0.5 + 0.5 * getMoistureFitness(tree, ecosystem) : 1.0;

  return BASE_MAX_SIZE * resilienceFactor * reproductionPenalty * moistureFactor;
}

function getAgeToSpread(tree: Tree): number {
  // Pioneer species (high reproduction + low resilience) reproduce earlier
  // Climax species (low reproduction + high resilience) reproduce later
  const reproductionFactor = 2 - tree.characteristics.reproductionRate;
  const resilienceFactor = 0.7 + 0.6 * tree.characteristics.resilience; // 0.7 to 1.3
  return BASE_AGE_TO_SPREAD * reproductionFactor * resilienceFactor;
}

function getSpreadChance(tree: Tree, ecosystem: Ecosystem): number {
  const baseChance = ecosystem.params.baseSpreadChance * (0.5 + tree.characteristics.reproductionRate);

  // Moisture fitness: affects reproduction rate (0.4x to 1.0x)
  const moistureFitness = getMoistureFitness(tree, ecosystem);
  const moistureFactor = 0.4 + 0.6 * moistureFitness;

  // Moisture-dependent strategy: reproduction is MUCH MORE costly in dry conditions
  // Dry = harsh, favors K-strategy (low reproduction, high resilience)
  // Wet = abundant, favors r-strategy (high reproduction, low resilience)
  // This creates density gradients: wet valleys are dense, dry mountains are sparse
  const moisture = getMoisture(tree, ecosystem);
  const moistureBonus = 0.4 + 1.2 * moisture; // 40% in dry, 160% in wet (stronger gradient)

  return baseChance * moistureFactor * moistureBonus;
}

export function getSpreadDistance(tree: Tree): number {
  // Reproduction rate increases spread distance (0.5x to 1.5x)
  // High reproduction = seeds spread farther
  return BASE_SPREAD_DISTANCE * (0.5 + tree.characteristics.reproductionRate);
}

function getGrowthAmount(tree: Tree, crowdedness: number, ecosystem: Ecosystem): number {
  // Base growth is 1 per tick
  let growth = 1.0;

  // Resilience penalty: high resilience = slower growth (r/K trade-off)
  // Low resilience trees grow fast, high resilience grow slow but survive better
  growth *= (1.5 - 0.9 * tree.characteristics.resilience);

  // Moisture fitness: strongly affects growth rate (0.3x to 1.0x)
  const moistureFitness = getMoistureFitness(tree, ecosystem);
  growth *= 0.3 + 0.7 * moistureFitness;

  // Pioneer vs Climax species dynamics:
  // Low crowding = pioneers (low resilience) thrive with bonus
  // High crowding = climax species (high resilience) do better
  if (crowdedness > 0) {
    const crowdingVulnerability = 1.5 - tree.characteristics.resilience;
    growth *= (1 - crowdedness * crowdingVulnerability);
  } else {
    // Pioneer bonus in uncrowded areas
    const pioneerBonus = 1 + (1 - tree.characteristics.resilience) * 0.3; // Up to +30% for low resilience
    growth *= pioneerBonus;
  }

  return growth;
}

function getDeathChance(tree: Tree, ecosystem: Ecosystem): number {
  // Resilience reduces base death chance (but not too much!)
  const baseDeath = BASE_DEATH_CHANCE * (1 - 0.4 * tree.characteristics.resilience);

  // Moisture stress: being far from optimal moisture increases death chance
  const moistureFitness = getMoistureFitness(tree, ecosystem);
  const moistureStress = 1.0 + 1.0 * (1 - moistureFitness); // 1.0x at optimal, 2.8x at worst

  return baseDeath * moistureStress;
}

function getCrowdedDeathChance(tree: Tree, ecosystem: Ecosystem): number {
  // Resilience reduces crowding death chance (weakened from 100% to 60%)
  let deathChance = ecosystem.params.baseCrowdedDeathChance * (1 - 0.6 * tree.characteristics.resilience);

  // Young trees (age < 5) are less susceptible to crowding death
  if (tree.age < 5) {
    const ageProtection = (5 - tree.age) / 5; // 1.0 at age 0, 0.0 at age 5
    deathChance *= (1 - ageProtection * 0.6); // Up to 60% reduction for very young trees
  }

  // Moisture fitness: trees in optimal moisture are more resilient to crowding
  const moistureFitness = getMoistureFitness(tree, ecosystem);
  const moistureResilience = 0.6 + 0.4 * moistureFitness; // 0.6x resilience at worst, 1.0x at optimal
  deathChance *= moistureResilience;

  // Moisture-dependent crowding pressure:
  // Wet regions = denser forests = more intense crowding competition
  // Dry regions = sparse = less crowding pressure
  const moisture = getMoisture(tree, ecosystem);
  const crowdingIntensity = 0.6 + 0.8 * moisture; // 60% in dry, 140% in wet
  deathChance *= crowdingIntensity;

  return deathChance;
}

// Color calculation: Trees in green tones, deer in brown/grey tones
export function getTreeColor(characteristics: TreeCharacteristics): number {
  // Map characteristics to green color space
  // Base green, but vary hue slightly (90-150°), saturation, and lightness

  // Hue: 90-150° (yellow-green to blue-green) based on optimal moisture
  // Low moisture preference = yellow-green, high moisture = blue-green
  const hue = 90 + characteristics.optimalMoisture * 60;

  // Saturation: 40-90% based on reproduction rate (more vibrant = more reproductive)
  const saturation = 40 + characteristics.reproductionRate * 50;

  // Lightness: 25-55% based on resilience (darker = more resilient/hardy)
  const lightness = 25 + characteristics.resilience * 30;

  return hslToRgb(hue, saturation, lightness);
}

export function getDeerColor(characteristics: DeerCharacteristics): number {
  // Map characteristics to brown/grey/blonde tones
  // Hue around 30-40° (brown/tan), with saturation and lightness varying

  // Hue: 25-45° (orange-brown range) based on vitality
  // Low vitality = greyer/cooler, high vitality = warmer/brown
  const hue = 25 + characteristics.vitality * 20;

  // Saturation: 15-60% based on appetite (hungrier = more saturated/brown)
  const saturation = 15 + characteristics.appetite * 45;

  // Lightness: 30-60% based on speed (faster = lighter/blonde)
  const lightness = 30 + characteristics.speed * 30;

  return hslToRgb(hue, saturation, lightness);
}

export function getWolfColor(characteristics: WolfCharacteristics): number {
  // Map characteristics to grey/dark tones (wolves are typically grey/black)
  // Hue around 210-240° (blue-grey range)

  // Hue: 200-240° (grey-blue range) based on hunting ability
  // Low hunting = warmer grey, high hunting = cooler/blue grey
  const hue = 200 + characteristics.hunting * 40;

  // Saturation: 5-25% based on vitality (low saturation for grey tones)
  const saturation = 5 + characteristics.vitality * 20;

  // Lightness: 20-45% based on speed (faster = lighter grey, darker = slower/stealthy)
  const lightness = 20 + characteristics.speed * 25;

  return hslToRgb(hue, saturation, lightness);
}

// Convert HSL to RGB hex color
function hslToRgb(h: number, s: number, l: number): number {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;

  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  const red = Math.floor((r + m) * 255);
  const green = Math.floor((g + m) * 255);
  const blue = Math.floor((b + m) * 255);

  return (red << 16) | (green << 8) | blue;
}

// Deer property calculations
function getDeerSpeed(deer: Deer): number {
  // Speed affects movement distance (0.5x to 1.5x base)
  return BASE_DEER_SPEED * (0.5 + deer.characteristics.speed);
}

function getDeerMaxEatableSize(deer: Deer): number {
  // Appetite affects max eatable tree size (bigger appetite = can tackle bigger trees)
  // Range: 50% to 120% of base
  return BASE_DEER_MAX_EATABLE_SIZE * (0.5 + 0.7 * deer.characteristics.appetite);
}

function getDeerAppetite(deer: Deer): number {
  // Appetite: how many trees deer wants to eat per tick (0.5 to 2.5)
  // Higher appetite = more food needed but can eat bigger trees
  return 0.5 + 2 * deer.characteristics.appetite;
}

function getDeerCrowdedness(deer: Deer, ecosystem: Ecosystem): number {
  // Count how many other deer are nearby (within crowding radius)
  let nearbyDeer = 0;

  for (const other of ecosystem.deer) {
    if (other.id === deer.id) continue;

    const distance = Math.sqrt((other.x - deer.x) ** 2 + (other.y - deer.y) ** 2);
    if (distance < DEER_CROWDING_RADIUS) {
      nearbyDeer++;
    }
  }

  return nearbyDeer;
}

function getDeerDeathChance(deer: Deer, treesEaten: number, ecosystem: Ecosystem): number {
  // Base death chance affected by speed (energy cost) but reduced by vitality
  // High speed = more risk (energy burn), high vitality = less risk
  const speedPenalty = 1 + 0.8 * deer.characteristics.speed; // Increased from 0.5 to 0.8
  const vitalityBonus = 1 - 0.5 * deer.characteristics.vitality; // Increased from 0.4 to 0.5
  let deathChance = BASE_DEER_DEATH_CHANCE * speedPenalty * vitalityBonus;

  // Starvation: if didn't eat enough
  // High appetite = more vulnerable to starvation (need more food)
  // Low vitality also increases vulnerability
  const appetite = getDeerAppetite(deer);
  const shortfall = Math.max(0, appetite - treesEaten);
  const appetiteVulnerability = 0.5 + deer.characteristics.appetite; // High appetite = more vulnerable
  const vitalityStarvationResistance = 1.5 - 0.5 * deer.characteristics.vitality;
  deathChance += shortfall * ecosystem.params.deerStarvationPenalty * appetiteVulnerability * vitalityStarvationResistance;

  // Crowding/disease: nearby deer increase death chance
  // Vitality provides STRONG disease resistance (creates niche differentiation)
  const nearbyDeer = getDeerCrowdedness(deer, ecosystem);
  const diseaseResistance = 1.5 - 1.2 * deer.characteristics.vitality; // Low vit = 1.5x, High vit = 0.3x (huge difference!)
  const crowdingPenalty = nearbyDeer * DEER_CROWDING_DEATH_PENALTY * diseaseResistance;
  deathChance += crowdingPenalty;

  return deathChance;
}

function getDeerReproduceChance(deer: Deer, ecosystem: Ecosystem): number {
  // Starving deer (energy < 1.0) cannot reproduce
  if (deer.energy < 1.0) {
    return 0;
  }

  // Well-fed deer (energy 1.0-2.0) reproduce at increasing rate
  const energyFactor = (deer.energy - 1.0); // 0 at energy=1.0, 1.0 at energy=2.0

  // Boom-Bust Specialists vs Steady Survivors:
  // Low vitality = boom-bust strategy (high reproduction when conditions good, die when bad)
  // High vitality = steady strategy (lower reproduction, but survive lean times)
  // Create non-linear relationship: extremes are specialists
  const vitalityReproductionCurve = deer.characteristics.vitality < 0.5
    ? 1.2 - deer.characteristics.vitality * 0.8  // Low vitality: 1.2 to 0.8 (boom specialists)
    : 0.8 + (deer.characteristics.vitality - 0.5) * 0.4; // High vitality: 0.8 to 1.0 (steady)

  // Speed trade-off: high speed = nomadic (less reproduction, more survival through escape)
  // Low speed = territorial (more reproduction, need vitality for local survival)
  const speedPenalty = 1 - 0.4 * deer.characteristics.speed;

  // Appetite affects reproduction: specialists in different ways
  // High appetite = opportunistic breeders (reproduce fast when food available)
  const appetiteBonus = 0.8 + 0.4 * deer.characteristics.appetite;

  // Crowding/disease reduces reproduction
  // Sick/stressed deer in crowded conditions reproduce less
  const nearbyDeer = getDeerCrowdedness(deer, ecosystem);
  const crowdingStress = Math.max(0, 1 - nearbyDeer * 0.15); // Each nearby deer reduces reproduction by 15%

  // Low population recovery bonus - when deer are rare, reproduction is easier
  const populationBonus = ecosystem.deer.length === 1 ? 3.0 : ecosystem.deer.length < 5 ? 1.8 : 1.0;

  return BASE_DEER_REPRODUCE_CHANCE * energyFactor * vitalityReproductionCurve * speedPenalty * appetiteBonus * crowdingStress * populationBonus;
}

// Wolf property calculations
function getWolfSpeed(wolf: Wolf): number {
  // Speed affects movement distance (0.7x to 1.3x base)
  return BASE_WOLF_SPEED * (0.7 + 0.6 * wolf.characteristics.speed);
}

function getWolfHuntRadius(wolf: Wolf): number {
  // Hunting ability increases detection range (0.6x to 1.4x base)
  return WOLF_HUNT_RADIUS * (0.6 + 0.8 * wolf.characteristics.hunting);
}

function getWolfCrowdedness(wolf: Wolf, ecosystem: Ecosystem): number {
  // Count how many other wolves are nearby
  let nearbyWolves = 0;

  for (const other of ecosystem.wolves) {
    if (other.id === wolf.id) continue;

    const distance = Math.sqrt((other.x - wolf.x) ** 2 + (other.y - wolf.y) ** 2);
    if (distance < WOLF_CROWDING_RADIUS) {
      nearbyWolves++;
    }
  }

  return nearbyWolves;
}

function getWolfDeathChance(wolf: Wolf, deerEaten: number, ecosystem: Ecosystem): number {
  // Base death chance affected by speed (energy cost) but reduced by vitality
  const speedPenalty = 1 + 0.6 * wolf.characteristics.speed;
  const vitalityBonus = 1 - 0.6 * wolf.characteristics.vitality;
  let deathChance = BASE_WOLF_DEATH_CHANCE * speedPenalty * vitalityBonus;

  // Starvation: wolves need to eat regularly (but can survive a few ticks without food)
  if (deerEaten === 0 && wolf.energy < 0.5) {
    const vitalityStarvationResistance = 1.5 - 0.5 * wolf.characteristics.vitality;
    deathChance += WOLF_STARVATION_PENALTY * vitalityStarvationResistance * 2; // Only severe when very low energy
  }

  // Crowding/territorial stress
  const nearbyWolves = getWolfCrowdedness(wolf, ecosystem);
  const diseaseResistance = 1.5 - 1.2 * wolf.characteristics.vitality;
  const crowdingPenalty = nearbyWolves * WOLF_CROWDING_DEATH_PENALTY * diseaseResistance;
  deathChance += crowdingPenalty;

  return deathChance;
}

function getWolfReproduceChance(wolf: Wolf, ecosystem: Ecosystem): number {
  // Lone wolves can reproduce at lower energy threshold for faster recovery
  const energyThreshold = ecosystem.wolves.length === 1 ? 0.8 : 1.0;

  // Starving wolves cannot reproduce
  if (wolf.energy < energyThreshold) {
    return 0;
  }

  // Well-fed wolves reproduce at increasing rate
  const energyFactor = Math.min(1, (wolf.energy - energyThreshold) / 1.0);

  // Vitality affects reproduction
  const vitalityBonus = 0.8 + 0.4 * wolf.characteristics.vitality;

  // Hunting ability slightly increases reproduction (successful hunters breed more)
  const huntingBonus = 0.9 + 0.2 * wolf.characteristics.hunting;

  // Crowding reduces reproduction (territorial animals)
  const nearbyWolves = getWolfCrowdedness(wolf, ecosystem);
  const crowdingStress = Math.max(0, 1 - nearbyWolves * 0.2); // Each nearby wolf reduces reproduction by 20%

  // Low population recovery bonus - when wolves are rare, reproduction is MUCH easier
  const populationBonus = ecosystem.wolves.length === 1 ? 4.0 : ecosystem.wolves.length < 5 ? 1.5 : 1.0;

  return BASE_WOLF_REPRODUCE_CHANCE * energyFactor * vitalityBonus * huntingBonus * crowdingStress * populationBonus;
}

// Terrain generation - creates moisture map
function generateTerrain(): number[][] {
  const terrain: number[][] = [];

  for (let x = 0; x < GRID_SIZE; x++) {
    terrain[x] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      const nx = x / GRID_SIZE;
      const ny = y / GRID_SIZE;

      // Overlay sine waves to create moisture variation across the map
      const wave1 = 0.5 * Math.sin(nx * Math.PI * 2 * 1.3) * Math.cos(ny * Math.PI * 2 * 0.9);
      const wave2 = 0.3 * Math.sin(nx * Math.PI * 2 * 2.7 + 1.2) * Math.sin(ny * Math.PI * 2 * 2.1);
      const wave3 = 0 //0.2 * Math.cos(nx * Math.PI * 2 * 4.1 + 2.5) * Math.cos(ny * Math.PI * 2 * 3.8 + 0.8);

      // Combine and normalize to [0, 1] moisture range
      const moisture = (wave1 + wave2 + wave3 + 1) / 2;
      terrain[x][y] = Math.max(0, Math.min(1, moisture));
    }
  }

  return terrain;
}

// Initialization
export function initializeEcosystem(params: Partial<SimulationParams> = {}): Ecosystem {
  const numInitialTrees = 500;
  const numInitialDeer = 100;
  const numInitialWolves = 4; // Initial wolf population for viable predation
  const trees: Tree[] = [];
  const grid: Map<string, Tree[]> = new Map();
  const deer: Deer[] = [];
  const wolves: Wolf[] = [];
  const terrain = generateTerrain();

  // Merge provided params with defaults
  const finalParams: SimulationParams = {
    ...DEFAULT_SIMULATION_PARAMS,
    ...params
  };

  for (let i = 0; i < numInitialTrees; i++) {
    const tree: Tree = {
      id: treeIdGenerator.next(),
      x: Math.random(),
      y: Math.random(),
      age: 0,
      size: 0,
      characteristics: {
        optimalMoisture: Math.random(),
        resilience: Math.random(),
        reproductionRate: Math.random()
      }
    };
    trees.push(tree);
    const cell = getCell(tree);
    grid.set(cell, [...(grid.get(cell) || []), tree]);
  }

  for (let i = 0; i < numInitialDeer; i++) {
    const newDeer: Deer = {
      id: deerIdGenerator.next(),
      x: Math.random(),
      y: Math.random(),
      age: 0,
      energy: 1, // Start with moderate energy
      characteristics: {
        vitality: Math.random(),
        speed: Math.random(),
        appetite: Math.random()
      }
    };
    deer.push(newDeer);
  }

  for (let i = 0; i < numInitialWolves; i++) {
    const newWolf: Wolf = {
      id: wolfIdGenerator.next(),
      x: Math.random(),
      y: Math.random(),
      age: 0,
      energy: 1.5, // Start with good energy (well-fed)
      characteristics: {
        vitality: Math.random(),
        speed: Math.random(),
        hunting: Math.random()
      }
    };
    wolves.push(newWolf);
  }

  return {
    trees,
    grid,
    deer,
    wolves,
    terrain,
    params: finalParams
  };
}

// Update ecosystem
// Optional: precalculatedCrowdedness can be provided by GPU acceleration
export function updateEcosystem(ecosystem: Ecosystem, precalculatedCrowdedness?: number[]) {
  const newTrees: Tree[] = [];

  ecosystem.trees = ecosystem.trees.filter((tree, treeIndex) => {
    tree.age += 1;
    const maxSize = getMaxSize(tree, ecosystem);

    // Only check crowdedness if tree can still grow
    if (tree.size < maxSize) {
      // Use precalculated crowdedness if available (from GPU), otherwise compute on CPU
      const crowd = precalculatedCrowdedness
        ? precalculatedCrowdedness[treeIndex]
        : crowdedness(tree, ecosystem);
      const growthAmount = getGrowthAmount(tree, crowd, ecosystem);

      // Trees can still grow even when crowded (just slower)
      tree.size = Math.min(maxSize, tree.size + growthAmount);

      // Crowded death check - proportional to crowdedness
      // Death chance increases with crowding (any crowding > 0 can cause death)
      if (crowd > 0) {
        const crowdedDeathChance = getCrowdedDeathChance(tree, ecosystem) * crowd;
        if (Math.random() < crowdedDeathChance) {
          deleteFromGrid(ecosystem, tree);
          return false;
        }
      }
    }

    // Natural death check
    if (Math.random() < getDeathChance(tree, ecosystem)) {
      deleteFromGrid(ecosystem, tree);
      return false;
    }

    // Reproduction check - must reach 30% of their personal max size
    // This allows all trees to reproduce, not just high-growth ones
    const sizeThreshold = getMaxSize(tree, ecosystem) * 0.3;
    const canReproduce = tree.age > getAgeToSpread(tree) && tree.size >= sizeThreshold;

    if (canReproduce && Math.random() < getSpreadChance(tree, ecosystem)) {
      const newLoc = newLocation(tree);
      if (newLoc != null) {
        const newTree: Tree = {
          id: treeIdGenerator.next(),
          x: newLoc[0],
          y: newLoc[1],
          age: 0,
          size: 0,
          characteristics: {
            optimalMoisture: clamp(
              tree.characteristics.optimalMoisture + mutate(),
              0,
              1
            ),
            resilience: clamp(
              tree.characteristics.resilience + mutate(),
              0,
              1
            ),
            reproductionRate: clamp(
              tree.characteristics.reproductionRate + mutate(),
              0,
              1
            )
          }
        };
        newTrees.push(newTree);
      }
    }
    return true;
  });

  ecosystem.trees.push(...newTrees);
  newTrees.forEach((tree) => {
    const cell = getCell(tree);
    const cellTrees = ecosystem.grid.get(cell);
    if (cellTrees) {
      cellTrees.push(tree);
    } else {
      ecosystem.grid.set(cell, [tree]);
    }
  });

  // Update deer
  const newDeer: Deer[] = [];
  ecosystem.deer = ecosystem.deer.filter((deer) => {
    deer.age += 1;

    // Move deer - toward food if hungry, otherwise randomly
    const speed = getDeerSpeed(deer);
    const maxEatableSize = getDeerMaxEatableSize(deer);

    // If hungry, look for nearby trees to move toward
    let targetTree: Tree | null = null;
    if (deer.energy < 1.5) {
      let closestDistance = DEER_FOOD_SEARCH_RADIUS;

      for (const tree of ecosystem.trees) {
        if (tree.size <= maxEatableSize) {
          const distance = Math.sqrt((tree.x - deer.x) ** 2 + (tree.y - deer.y) ** 2);
          if (distance < closestDistance) {
            closestDistance = distance;
            targetTree = tree;
          }
        }
      }
    }

    if (targetTree) {
      // Move toward target tree
      const dx = targetTree.x - deer.x;
      const dy = targetTree.y - deer.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      deer.x += (dx / distance) * speed;
      deer.y += (dy / distance) * speed;
    } else {
      // Move randomly
      const angle = Math.random() * Math.PI * 2;
      deer.x += Math.cos(angle) * speed;
      deer.y += Math.sin(angle) * speed;
    }

    // Wrap around edges
    deer.x = (deer.x + 1) % 1;
    deer.y = (deer.y + 1) % 1;

    // Deer eat nearby trees (only when hungry)
    const appetite = getDeerAppetite(deer);
    let treesEaten = 0;

    // Only eat if energy is below 1.8 (not completely full)
    if (deer.energy < 1.8) {
      for (let i = ecosystem.trees.length - 1; i >= 0 && treesEaten < appetite && deer.energy < 2; i--) {
        const tree = ecosystem.trees[i];
        const distance = Math.sqrt((tree.x - deer.x) ** 2 + (tree.y - deer.y) ** 2);

        if (distance < DEER_EATING_RADIUS && tree.size <= maxEatableSize) {
          // Eat the tree!
          deleteFromGrid(ecosystem, tree);
          ecosystem.trees.splice(i, 1);
          treesEaten++;
          deer.energy = Math.min(2, deer.energy + 0.3); // Gain energy from eating
        }
      }
    }

    // Decay energy over time - faster decay for high speed (nomadic cost) and high appetite
    const baseDecay = 0.1;
    const speedDecay = deer.characteristics.speed * 0.05; // Fast deer burn more energy
    const appetiteDecay = deer.characteristics.appetite * 0.03; // High appetite = faster metabolism
    const totalDecay = baseDecay + speedDecay + appetiteDecay;
    deer.energy = Math.max(0, deer.energy - totalDecay);

    // Death check (starvation + speed cost)
    // Hard floor: last deer never dies (allows recovery)
    if (ecosystem.deer.length > 1 && Math.random() < getDeerDeathChance(deer, treesEaten, ecosystem)) {
      return false;
    }

    // Reproduction check
    if (
      deer.age > ecosystem.params.deerReproduceAge &&
      Math.random() < getDeerReproduceChance(deer, ecosystem)
    ) {
      const babyDeer: Deer = {
        id: deerIdGenerator.next(),
        x: deer.x + (Math.random() - 0.5) * 0.05,
        y: deer.y + (Math.random() - 0.5) * 0.05,
        age: 0,
        energy: 1,
        characteristics: {
          vitality: clamp(deer.characteristics.vitality + mutate(), 0, 1),
          speed: clamp(deer.characteristics.speed + mutate(), 0, 1),
          appetite: clamp(deer.characteristics.appetite + mutate(), 0, 1)
        }
      };
      newDeer.push(babyDeer);
      // Reproduction cost varies:
      // - Low vitality deer pay more (weaker, harder pregnancy)
      // - High appetite deer pay more (need resources for big baby)
      // - Fast deer pay less (nomadic, quick births)
      const vitalityCost = 1.5 - 0.5 * deer.characteristics.vitality;
      const appetiteCost = 0.8 + 0.4 * deer.characteristics.appetite;
      const speedBonus = 1.2 - 0.2 * deer.characteristics.speed;
      const reproductionCost = 0.5 * vitalityCost * appetiteCost * speedBonus;
      deer.energy -= reproductionCost;
    }

    return true;
  });

  ecosystem.deer.push(...newDeer);

  // Update wolves
  const newWolves: Wolf[] = [];
  ecosystem.wolves = ecosystem.wolves.filter((wolf) => {
    wolf.age += 1;

    // Move wolf - toward prey if hungry, otherwise patrol
    const speed = getWolfSpeed(wolf);
    const huntRadius = getWolfHuntRadius(wolf);

    // If hungry, hunt for nearby deer
    let targetDeer: Deer | null = null;
    if (wolf.energy < 1.8) {
      let closestDistance = huntRadius;

      for (const deer of ecosystem.deer) {
        const distance = Math.sqrt((deer.x - wolf.x) ** 2 + (deer.y - wolf.y) ** 2);
        if (distance < closestDistance) {
          closestDistance = distance;
          targetDeer = deer;
        }
      }
    }

    if (targetDeer) {
      // Chase target deer
      const dx = targetDeer.x - wolf.x;
      const dy = targetDeer.y - wolf.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      wolf.x += (dx / distance) * speed;
      wolf.y += (dy / distance) * speed;
    } else {
      // Move randomly (patrolling)
      const angle = Math.random() * Math.PI * 2;
      wolf.x += Math.cos(angle) * speed;
      wolf.y += Math.sin(angle) * speed;
    }

    // Wrap around edges
    wolf.x = (wolf.x + 1) % 1;
    wolf.y = (wolf.y + 1) % 1;

    // Wolf hunts nearby deer
    let deerEaten = 0;

    // Only hunt if hungry
    if (wolf.energy < 2) {
      for (let i = ecosystem.deer.length - 1; i >= 0 && deerEaten < 1 && wolf.energy < 2; i--) {
        const deer = ecosystem.deer[i];
        const distance = Math.sqrt((deer.x - wolf.x) ** 2 + (deer.y - wolf.y) ** 2);

        if (distance < WOLF_KILL_RADIUS) {
          // Last deer can't be hunted - hard floor for extinction prevention
          if (ecosystem.deer.length === 1) {
            continue;
          }

          // Hunt success depends on hunting ability vs deer speed
          const huntingSkill = 0.6 + 0.4 * wolf.characteristics.hunting; // 60-100% base success
          const deerEvasion = deer.characteristics.speed * 0.25; // Up to 25% evasion
          const successChance = Math.max(0.3, huntingSkill - deerEvasion); // At least 30% chance

          if (Math.random() < successChance) {
            // Kill the deer!
            ecosystem.deer.splice(i, 1);
            deerEaten++;
            // Lone wolves get more energy per kill (eat the whole deer, no sharing)
            const energyGain = ecosystem.wolves.length === 1 ? 2.2 : 1.8;
            wolf.energy = Math.min(3.0, wolf.energy + energyGain);
          }
        }
      }
    }

    // Decay energy over time - faster decay for high speed
    // Lone wolves have slower metabolism (less energy wasted on pack dynamics)
    const metabolismMultiplier = ecosystem.wolves.length === 1 ? 0.7 : 1.0;
    const baseDecay = 0.04 * metabolismMultiplier;
    const speedDecay = wolf.characteristics.speed * 0.015 * metabolismMultiplier;
    const totalDecay = baseDecay + speedDecay;
    wolf.energy = Math.max(0, wolf.energy - totalDecay);

    // Scavenging: when deer are very scarce, wolves can find alternative food (small animals, carrion)
    // This prevents starvation deadlock but only sustains survival, not reproduction
    if (ecosystem.deer.length <= 5 && wolf.energy < 1.0) {
      const scavengingBonus = 0.025 * (1 + wolf.characteristics.hunting * 0.3); // Better hunters find more
      wolf.energy = Math.min(1.0, wolf.energy + scavengingBonus); // Cap at 1.0 - need hunting for reproduction
    }

    // Death check (starvation + crowding)
    // Hard floor: last wolf never dies (allows recovery)
    if (ecosystem.wolves.length > 1 && Math.random() < getWolfDeathChance(wolf, deerEaten, ecosystem)) {
      return false;
    }

    // Reproduction check (lower age requirement allows faster population recovery)
    if (
      wolf.age > 5 &&
      Math.random() < getWolfReproduceChance(wolf, ecosystem)
    ) {
      const babyWolf: Wolf = {
        id: wolfIdGenerator.next(),
        x: wolf.x + (Math.random() - 0.5) * 0.05,
        y: wolf.y + (Math.random() - 0.5) * 0.05,
        age: 0,
        energy: 1.5,
        characteristics: {
          vitality: clamp(wolf.characteristics.vitality + mutate(), 0, 1),
          speed: clamp(wolf.characteristics.speed + mutate(), 0, 1),
          hunting: clamp(wolf.characteristics.hunting + mutate(), 0, 1)
        }
      };
      newWolves.push(babyWolf);
      // Reproduction cost
      const vitalityCost = 1.5 - 0.5 * wolf.characteristics.vitality;
      const reproductionCost = 0.6 * vitalityCost;
      wolf.energy -= reproductionCost;
    }

    return true;
  });

  ecosystem.wolves.push(...newWolves);
}

function deleteFromGrid(ecosystem: Ecosystem, tree: Tree) {
  const cellKey = getCell(tree);
  const cell = ecosystem.grid.get(cellKey);
  if (!cell) return;

  const index = cell.findIndex((t) => t.id === tree.id);
  if (index !== -1) {
    cell.splice(index, 1);
  }
}

function crowdedness(tree: Tree, ecosystem: Ecosystem): number {
  let crowdednessSum = 0;

  // Check the tree's cell and all 8 neighboring cells
  const treeCell = getCell(tree);
  const [cellX, cellY] = treeCell.split(',').map(Number);

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const neighborCell = `${cellX + dx},${cellY + dy}`;
      const trees = ecosystem.grid.get(neighborCell) || [];

      for (const t of trees) {
        if (t.id === tree.id) continue;

        // Vertical Stratification: Size difference matters
        // Large trees (canopy) shade small trees (understory) asymmetrically
        const sizeDifference = t.size - tree.size;

        // Only trees larger than this one cause significant crowding
        if (sizeDifference <= 0) {
          // Same size or smaller trees cause minimal crowding
          // (Competition for resources, but no shading)
          continue;
        }

        // Shading radius based on the LARGE tree's spread and size
        const sizeRatio = t.size / getMaxSize(t, ecosystem);
        const maxDistance = getSpreadDistance(t) * sizeRatio;

        // Use squared distance to avoid expensive sqrt
        const distanceSquared = (t.x - tree.x) ** 2 + (t.y - tree.y) ** 2;
        const maxDistanceSquared = maxDistance * maxDistance;

        if (distanceSquared < maxDistanceSquared) {
          const distance = Math.sqrt(distanceSquared);
          const proximity = (maxDistance - distance) / maxDistance;

          // Canopy vs Understory dynamics:
          // Larger the size difference, more the shading effect
          // High resilience trees (understory specialists) tolerate shade better
          const shadingIntensity = Math.min(2, sizeDifference / 5); // Up to 2x for big size gaps
          const shadeToleranceMultiplier = 1.5 - 0.5 * tree.characteristics.resilience; // Low res = 1.5x, High res = 1.0x

          crowdednessSum += proximity * 0.6 * shadingIntensity * shadeToleranceMultiplier;
        }
      }
    }
  }
  return Math.min(1, crowdednessSum);
}

function newLocation(tree: Tree): [number, number] | null {
  const dist = getSpreadDistance(tree);
  const newX = tree.x + Math.random() * 2 * dist - dist;
  const newY = tree.y + Math.random() * 2 * dist - dist;
  if (newX > 1 || newX < 0 || newY > 1 || newY < 0) {
    return null;
  }
  return [newX, newY];
}

export function getCell(tree: Tree): string {
  const x = Math.floor(tree.x * GRID_SIZE);
  const y = Math.floor(tree.y * GRID_SIZE);
  return `${x},${y}`;
}

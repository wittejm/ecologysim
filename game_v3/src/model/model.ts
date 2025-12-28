// Grid density - number of cells in each dimension
export const GRID_SIZE = 20;

// Ecosystem scale - multiplies all distances
export const ECOSYSTEM_SCALE = 0.5;

// Constants for interaction radii (base values, will be scaled by ECOSYSTEM_SCALE)
const DEER_EATING_RADIUS_BASE = 0.03;
const DEER_CROWDING_RADIUS_BASE = 0.15;
const WOLF_KILL_RADIUS_BASE = 0.035;
const WOLF_CROWDING_RADIUS_BASE = 0.3;

// Crowding penalty constants
const DEER_CROWDING_DEATH_PENALTY = 0.002;
const WOLF_CROWDING_DEATH_PENALTY = 0.006;
const TREE_CROWDED_DEATH_BASE = 0.5;

// Minimum crowding effects (hard cap) - even min susceptibility trees suffer these effects
const MIN_CROWDING_GROWTH_REDUCTION = 0.25; // At max crowding, min 25% growth reduction
const MIN_CROWDING_DEATH_MULTIPLIER = 0.40;  // At max crowding, min 40% of base death effect

// Energy constants
const DEER_MAX_ENERGY = 2.0;
const DEER_REPRODUCE_THRESHOLD = 1.0;
const DEER_REPRODUCE_AGE = 10;
const DEER_REPRODUCTION_COST = 0.5;

const WOLF_MAX_ENERGY = 2.5;
const WOLF_REPRODUCE_THRESHOLD = 1.0;
const WOLF_REPRODUCE_AGE = 5;
const WOLF_REPRODUCTION_COST = 0.6;
const WOLF_HUNT_SUCCESS_BASE = 0.7;

// Characteristic bounds for Trees
export const TREE_BOUNDS = {
  MaxSize: { min: 5, max: 25 },
  AgeToSpread: { min: 3, max: 20 },
  SpreadDistance: { min: 0.03, max: 0.15 },
  DeathChance: { min: 0.002, max: 0.025 },  // Balanced natural death
  SpreadChance: { min: 0.08, max: 0.25 },  // Increased spread back up
  OptimalMoisture: { min: 0, max: 1 },
  CrowdingSusceptibility: { min: 0.5, max: 2.0 }
};

// Characteristic bounds for Deer
export const DEER_BOUNDS = {
  MaxSize: { min: 2, max: 5 },
  Speed: { min: 0.003, max: 0.015 },
  DeathChance: { min: 0.00001, max: 0.0001 },
  ReproduceChance: { min: 0.4, max: 0.98 },  // Even higher reproduction
  CrowdingSusceptibility: { min: 0.5, max: 2.0 },
  MaxEatableSize: { min: 3, max: 15 },  // Can eat even larger trees
  EnergyNeeds: { min: 0.01, max: 0.05 }  // Drastically reduced energy needs
};

// Characteristic bounds for Wolves
export const WOLF_BOUNDS = {
  MaxSize: { min: 2.5, max: 6 },
  Speed: { min: 0.008, max: 0.025 },
  DeathChance: { min: 0.00001, max: 0.0003 },  // Slightly higher death
  ReproduceChance: { min: 0.05, max: 0.35 },  // Significantly reduced reproduction
  CrowdingSusceptibility: { min: 0.5, max: 2.0 },
  EnergyNeeds: { min: 0.025, max: 0.12 }  // Slightly increased energy needs
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
  MaxSize: number;
  AgeToSpread: number;
  SpreadDistance: number;
  DeathChance: number;
  SpreadChance: number;
  OptimalMoisture: number;
  CrowdingSusceptibility: number;
};

export type DeerCharacteristics = {
  MaxSize: number;
  Speed: number;
  DeathChance: number;
  ReproduceChance: number;
  CrowdingSusceptibility: number;
  MaxEatableSize: number;
  EnergyNeeds: number;
};

export type WolfCharacteristics = {
  MaxSize: number;
  Speed: number;
  DeathChance: number;
  ReproduceChance: number;
  CrowdingSusceptibility: number;
  EnergyNeeds: number;
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
  energy: number;
  characteristics: DeerCharacteristics;
};

export type Wolf = {
  id: number;
  x: number;
  y: number;
  age: number;
  energy: number;
  characteristics: WolfCharacteristics;
};

export type Ecosystem = {
  trees: Tree[];
  grid: Map<string, Tree[]>;
  deer: Deer[];
  wolves: Wolf[];
  terrain: number[][]; // GRID_SIZE x GRID_SIZE moisture grid (0-1)
};

// Utility functions
function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// Generate random characteristics within bounds
function randomTreeCharacteristics(): TreeCharacteristics {
  return {
    MaxSize: randomInRange(TREE_BOUNDS.MaxSize.min, TREE_BOUNDS.MaxSize.max),
    AgeToSpread: randomInRange(TREE_BOUNDS.AgeToSpread.min, TREE_BOUNDS.AgeToSpread.max),
    SpreadDistance: randomInRange(TREE_BOUNDS.SpreadDistance.min, TREE_BOUNDS.SpreadDistance.max) * ECOSYSTEM_SCALE,
    DeathChance: randomInRange(TREE_BOUNDS.DeathChance.min, TREE_BOUNDS.DeathChance.max),
    SpreadChance: randomInRange(TREE_BOUNDS.SpreadChance.min, TREE_BOUNDS.SpreadChance.max),
    OptimalMoisture: randomInRange(TREE_BOUNDS.OptimalMoisture.min, TREE_BOUNDS.OptimalMoisture.max),
    CrowdingSusceptibility: randomInRange(TREE_BOUNDS.CrowdingSusceptibility.min, TREE_BOUNDS.CrowdingSusceptibility.max)
  };
}

function randomDeerCharacteristics(): DeerCharacteristics {
  return {
    MaxSize: randomInRange(DEER_BOUNDS.MaxSize.min, DEER_BOUNDS.MaxSize.max),
    Speed: randomInRange(DEER_BOUNDS.Speed.min, DEER_BOUNDS.Speed.max) * ECOSYSTEM_SCALE,
    DeathChance: randomInRange(DEER_BOUNDS.DeathChance.min, DEER_BOUNDS.DeathChance.max),
    ReproduceChance: randomInRange(DEER_BOUNDS.ReproduceChance.min, DEER_BOUNDS.ReproduceChance.max),
    CrowdingSusceptibility: randomInRange(DEER_BOUNDS.CrowdingSusceptibility.min, DEER_BOUNDS.CrowdingSusceptibility.max),
    MaxEatableSize: randomInRange(DEER_BOUNDS.MaxEatableSize.min, DEER_BOUNDS.MaxEatableSize.max),
    EnergyNeeds: randomInRange(DEER_BOUNDS.EnergyNeeds.min, DEER_BOUNDS.EnergyNeeds.max)
  };
}

function randomWolfCharacteristics(): WolfCharacteristics {
  return {
    MaxSize: randomInRange(WOLF_BOUNDS.MaxSize.min, WOLF_BOUNDS.MaxSize.max),
    Speed: randomInRange(WOLF_BOUNDS.Speed.min, WOLF_BOUNDS.Speed.max) * ECOSYSTEM_SCALE,
    DeathChance: randomInRange(WOLF_BOUNDS.DeathChance.min, WOLF_BOUNDS.DeathChance.max),
    ReproduceChance: randomInRange(WOLF_BOUNDS.ReproduceChance.min, WOLF_BOUNDS.ReproduceChance.max),
    CrowdingSusceptibility: randomInRange(WOLF_BOUNDS.CrowdingSusceptibility.min, WOLF_BOUNDS.CrowdingSusceptibility.max),
    EnergyNeeds: randomInRange(WOLF_BOUNDS.EnergyNeeds.min, WOLF_BOUNDS.EnergyNeeds.max)
  };
}

// Get moisture level at a location from terrain
function getMoisture(x: number, y: number, terrain: number[][]): number {
  const gridX = Math.floor(x * GRID_SIZE);
  const gridY = Math.floor(y * GRID_SIZE);
  const clampedX = Math.max(0, Math.min(GRID_SIZE - 1, gridX));
  const clampedY = Math.max(0, Math.min(GRID_SIZE - 1, gridY));
  return terrain[clampedX][clampedY];
}

// Calculate moisture fitness: how well moisture matches tree's optimal
// Returns 0-1, where 1 is perfect match
function getMoistureFitness(tree: Tree, ecosystem: Ecosystem): number {
  const moisture = getMoisture(tree.x, tree.y, ecosystem.terrain);
  const distance = Math.abs(moisture - tree.characteristics.OptimalMoisture);
  // Simple inverse relationship: perfect match = 1, worst match = 0
  return Math.max(0, 1 - distance * 2);
}

// Color calculation
export function getTreeColor(characteristics: TreeCharacteristics): number {
  // Map to green color space based on characteristics
  // Hue: 90-150° based on optimal moisture
  const hue = 90 + characteristics.OptimalMoisture * 60;

  // Saturation: 40-90% based on spread chance
  const spreadNormalized = (characteristics.SpreadChance - TREE_BOUNDS.SpreadChance.min) /
    (TREE_BOUNDS.SpreadChance.max - TREE_BOUNDS.SpreadChance.min);
  const saturation = 40 + spreadNormalized * 50;

  // Lightness: 25-55% based on crowding susceptibility
  const crowdingNormalized = (characteristics.CrowdingSusceptibility - TREE_BOUNDS.CrowdingSusceptibility.min) /
    (TREE_BOUNDS.CrowdingSusceptibility.max - TREE_BOUNDS.CrowdingSusceptibility.min);
  const lightness = 55 - crowdingNormalized * 30; // Higher susceptibility = darker

  return hslToRgb(hue, saturation, lightness);
}

export function getDeerColor(characteristics: DeerCharacteristics): number {
  // Map to brown/tan color space
  // Hue: 25-45° (brown range)
  const speedNormalized = (characteristics.Speed - DEER_BOUNDS.Speed.min) /
    (DEER_BOUNDS.Speed.max - DEER_BOUNDS.Speed.min);
  const hue = 25 + speedNormalized * 20;

  // Saturation: 15-60%
  const reproduceNormalized = (characteristics.ReproduceChance - DEER_BOUNDS.ReproduceChance.min) /
    (DEER_BOUNDS.ReproduceChance.max - DEER_BOUNDS.ReproduceChance.min);
  const saturation = 15 + reproduceNormalized * 45;

  // Lightness: 30-60%
  const crowdingNormalized = (characteristics.CrowdingSusceptibility - DEER_BOUNDS.CrowdingSusceptibility.min) /
    (DEER_BOUNDS.CrowdingSusceptibility.max - DEER_BOUNDS.CrowdingSusceptibility.min);
  const lightness = 60 - crowdingNormalized * 30;

  return hslToRgb(hue, saturation, lightness);
}

export function getWolfColor(characteristics: WolfCharacteristics): number {
  // Map to grey color space
  // Hue: 200-240° (grey-blue range)
  const crowdingNormalized = (characteristics.CrowdingSusceptibility - WOLF_BOUNDS.CrowdingSusceptibility.min) /
    (WOLF_BOUNDS.CrowdingSusceptibility.max - WOLF_BOUNDS.CrowdingSusceptibility.min);
  const hue = 200 + crowdingNormalized * 40;

  // Saturation: 5-25%
  const reproduceNormalized = (characteristics.ReproduceChance - WOLF_BOUNDS.ReproduceChance.min) /
    (WOLF_BOUNDS.ReproduceChance.max - WOLF_BOUNDS.ReproduceChance.min);
  const saturation = 5 + reproduceNormalized * 20;

  // Lightness: 20-45%
  const speedNormalized = (characteristics.Speed - WOLF_BOUNDS.Speed.min) /
    (WOLF_BOUNDS.Speed.max - WOLF_BOUNDS.Speed.min);
  const lightness = 20 + speedNormalized * 25;

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

// Terrain generation - creates moisture map
function generateTerrain(): number[][] {
  const terrain: number[][] = [];

  for (let x = 0; x < GRID_SIZE; x++) {
    terrain[x] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      const nx = x / GRID_SIZE;
      const ny = y / GRID_SIZE;

      // Overlay sine waves to create moisture variation
      const wave1 = 0.5 * Math.sin(nx * Math.PI * 2 * 1.3) * Math.cos(ny * Math.PI * 2 * 0.9);
      const wave2 = 0.3 * Math.sin(nx * Math.PI * 2 * 2.7 + 1.2) * Math.sin(ny * Math.PI * 2 * 2.1);

      // Combine and normalize to [0, 1] moisture range
      const moisture = (wave1 + wave2 + 1) / 2;
      terrain[x][y] = Math.max(0, Math.min(1, moisture));
    }
  }

  return terrain;
}

// Helper functions to create characteristics from slider values (0-1)
export function createTreeCharacteristics(sliders: Record<string, number | null>): TreeCharacteristics {
  return {
    MaxSize: sliders.MaxSize !== null
      ? TREE_BOUNDS.MaxSize.min + sliders.MaxSize * (TREE_BOUNDS.MaxSize.max - TREE_BOUNDS.MaxSize.min)
      : randomInRange(TREE_BOUNDS.MaxSize.min, TREE_BOUNDS.MaxSize.max),
    AgeToSpread: sliders.AgeToSpread !== null
      ? TREE_BOUNDS.AgeToSpread.min + sliders.AgeToSpread * (TREE_BOUNDS.AgeToSpread.max - TREE_BOUNDS.AgeToSpread.min)
      : randomInRange(TREE_BOUNDS.AgeToSpread.min, TREE_BOUNDS.AgeToSpread.max),
    SpreadDistance: (sliders.SpreadDistance !== null
      ? TREE_BOUNDS.SpreadDistance.min + sliders.SpreadDistance * (TREE_BOUNDS.SpreadDistance.max - TREE_BOUNDS.SpreadDistance.min)
      : randomInRange(TREE_BOUNDS.SpreadDistance.min, TREE_BOUNDS.SpreadDistance.max)) * ECOSYSTEM_SCALE,
    DeathChance: sliders.DeathChance !== null
      ? TREE_BOUNDS.DeathChance.min + sliders.DeathChance * (TREE_BOUNDS.DeathChance.max - TREE_BOUNDS.DeathChance.min)
      : randomInRange(TREE_BOUNDS.DeathChance.min, TREE_BOUNDS.DeathChance.max),
    SpreadChance: sliders.SpreadChance !== null
      ? TREE_BOUNDS.SpreadChance.min + sliders.SpreadChance * (TREE_BOUNDS.SpreadChance.max - TREE_BOUNDS.SpreadChance.min)
      : randomInRange(TREE_BOUNDS.SpreadChance.min, TREE_BOUNDS.SpreadChance.max),
    OptimalMoisture: sliders.OptimalMoisture !== null
      ? TREE_BOUNDS.OptimalMoisture.min + sliders.OptimalMoisture * (TREE_BOUNDS.OptimalMoisture.max - TREE_BOUNDS.OptimalMoisture.min)
      : randomInRange(TREE_BOUNDS.OptimalMoisture.min, TREE_BOUNDS.OptimalMoisture.max),
    CrowdingSusceptibility: sliders.CrowdingSusceptibility !== null
      ? TREE_BOUNDS.CrowdingSusceptibility.min + sliders.CrowdingSusceptibility * (TREE_BOUNDS.CrowdingSusceptibility.max - TREE_BOUNDS.CrowdingSusceptibility.min)
      : randomInRange(TREE_BOUNDS.CrowdingSusceptibility.min, TREE_BOUNDS.CrowdingSusceptibility.max)
  };
}

export function createDeerCharacteristics(sliders: Record<string, number | null>): DeerCharacteristics {
  return {
    MaxSize: sliders.MaxSize !== null
      ? DEER_BOUNDS.MaxSize.min + sliders.MaxSize * (DEER_BOUNDS.MaxSize.max - DEER_BOUNDS.MaxSize.min)
      : randomInRange(DEER_BOUNDS.MaxSize.min, DEER_BOUNDS.MaxSize.max),
    Speed: (sliders.Speed !== null
      ? DEER_BOUNDS.Speed.min + sliders.Speed * (DEER_BOUNDS.Speed.max - DEER_BOUNDS.Speed.min)
      : randomInRange(DEER_BOUNDS.Speed.min, DEER_BOUNDS.Speed.max)) * ECOSYSTEM_SCALE,
    DeathChance: sliders.DeathChance !== null
      ? DEER_BOUNDS.DeathChance.min + sliders.DeathChance * (DEER_BOUNDS.DeathChance.max - DEER_BOUNDS.DeathChance.min)
      : randomInRange(DEER_BOUNDS.DeathChance.min, DEER_BOUNDS.DeathChance.max),
    ReproduceChance: sliders.ReproduceChance !== null
      ? DEER_BOUNDS.ReproduceChance.min + sliders.ReproduceChance * (DEER_BOUNDS.ReproduceChance.max - DEER_BOUNDS.ReproduceChance.min)
      : randomInRange(DEER_BOUNDS.ReproduceChance.min, DEER_BOUNDS.ReproduceChance.max),
    CrowdingSusceptibility: sliders.CrowdingSusceptibility !== null
      ? DEER_BOUNDS.CrowdingSusceptibility.min + sliders.CrowdingSusceptibility * (DEER_BOUNDS.CrowdingSusceptibility.max - DEER_BOUNDS.CrowdingSusceptibility.min)
      : randomInRange(DEER_BOUNDS.CrowdingSusceptibility.min, DEER_BOUNDS.CrowdingSusceptibility.max),
    MaxEatableSize: sliders.MaxEatableSize !== null
      ? DEER_BOUNDS.MaxEatableSize.min + sliders.MaxEatableSize * (DEER_BOUNDS.MaxEatableSize.max - DEER_BOUNDS.MaxEatableSize.min)
      : randomInRange(DEER_BOUNDS.MaxEatableSize.min, DEER_BOUNDS.MaxEatableSize.max),
    EnergyNeeds: sliders.EnergyNeeds !== null
      ? DEER_BOUNDS.EnergyNeeds.min + sliders.EnergyNeeds * (DEER_BOUNDS.EnergyNeeds.max - DEER_BOUNDS.EnergyNeeds.min)
      : randomInRange(DEER_BOUNDS.EnergyNeeds.min, DEER_BOUNDS.EnergyNeeds.max)
  };
}

export function createWolfCharacteristics(sliders: Record<string, number | null>): WolfCharacteristics {
  return {
    MaxSize: sliders.MaxSize !== null
      ? WOLF_BOUNDS.MaxSize.min + sliders.MaxSize * (WOLF_BOUNDS.MaxSize.max - WOLF_BOUNDS.MaxSize.min)
      : randomInRange(WOLF_BOUNDS.MaxSize.min, WOLF_BOUNDS.MaxSize.max),
    Speed: (sliders.Speed !== null
      ? WOLF_BOUNDS.Speed.min + sliders.Speed * (WOLF_BOUNDS.Speed.max - WOLF_BOUNDS.Speed.min)
      : randomInRange(WOLF_BOUNDS.Speed.min, WOLF_BOUNDS.Speed.max)) * ECOSYSTEM_SCALE,
    DeathChance: sliders.DeathChance !== null
      ? WOLF_BOUNDS.DeathChance.min + sliders.DeathChance * (WOLF_BOUNDS.DeathChance.max - WOLF_BOUNDS.DeathChance.min)
      : randomInRange(WOLF_BOUNDS.DeathChance.min, WOLF_BOUNDS.DeathChance.max),
    ReproduceChance: sliders.ReproduceChance !== null
      ? WOLF_BOUNDS.ReproduceChance.min + sliders.ReproduceChance * (WOLF_BOUNDS.ReproduceChance.max - WOLF_BOUNDS.ReproduceChance.min)
      : randomInRange(WOLF_BOUNDS.ReproduceChance.min, WOLF_BOUNDS.ReproduceChance.max),
    CrowdingSusceptibility: sliders.CrowdingSusceptibility !== null
      ? WOLF_BOUNDS.CrowdingSusceptibility.min + sliders.CrowdingSusceptibility * (WOLF_BOUNDS.CrowdingSusceptibility.max - WOLF_BOUNDS.CrowdingSusceptibility.min)
      : randomInRange(WOLF_BOUNDS.CrowdingSusceptibility.min, WOLF_BOUNDS.CrowdingSusceptibility.max),
    EnergyNeeds: sliders.EnergyNeeds !== null
      ? WOLF_BOUNDS.EnergyNeeds.min + sliders.EnergyNeeds * (WOLF_BOUNDS.EnergyNeeds.max - WOLF_BOUNDS.EnergyNeeds.min)
      : randomInRange(WOLF_BOUNDS.EnergyNeeds.min, WOLF_BOUNDS.EnergyNeeds.max)
  };
}

// Default initial counts
export const DEFAULT_TREE_COUNT = 120;
export const DEFAULT_DEER_COUNT = 30;
export const DEFAULT_WOLF_COUNT = 6;

// Initialization
export function initializeEcosystem(): Ecosystem {
  const numInitialTrees = DEFAULT_TREE_COUNT;
  const numInitialDeer = DEFAULT_DEER_COUNT;
  const numInitialWolves = DEFAULT_WOLF_COUNT;
  const trees: Tree[] = [];
  const grid: Map<string, Tree[]> = new Map();
  const deer: Deer[] = [];
  const wolves: Wolf[] = [];
  const terrain = generateTerrain();

  for (let i = 0; i < numInitialTrees; i++) {
    const tree: Tree = {
      id: treeIdGenerator.next(),
      x: Math.random(),
      y: Math.random(),
      age: 0,
      size: 0,
      characteristics: randomTreeCharacteristics()
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
      energy: 1.5,
      characteristics: randomDeerCharacteristics()
    };
    deer.push(newDeer);
  }

  for (let i = 0; i < numInitialWolves; i++) {
    const newWolf: Wolf = {
      id: wolfIdGenerator.next(),
      x: Math.random(),
      y: Math.random(),
      age: 0,
      energy: 1.5,
      characteristics: randomWolfCharacteristics()
    };
    wolves.push(newWolf);
  }

  return {
    trees,
    grid,
    deer,
    wolves,
    terrain
  };
}

// Grid utilities
export function getCell(entity: { x: number; y: number }): string {
  const x = Math.floor(entity.x * GRID_SIZE);
  const y = Math.floor(entity.y * GRID_SIZE);
  return `${x},${y}`;
}

// Get trees in current and neighboring grid cells
function getTreesInNeighborhood(entity: { x: number; y: number }, ecosystem: Ecosystem): Tree[] {
  const cell = getCell(entity);
  const [cellX, cellY] = cell.split(',').map(Number);
  const trees: Tree[] = [];

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const neighborCell = `${cellX + dx},${cellY + dy}`;
      const cellTrees = ecosystem.grid.get(neighborCell);
      if (cellTrees) {
        trees.push(...cellTrees);
      }
    }
  }

  return trees;
}

// Get deer in current and neighboring grid cells
function getDeerInNeighborhood(entity: { x: number; y: number }, ecosystem: Ecosystem): Deer[] {
  const cell = getCell(entity);
  const [cellX, cellY] = cell.split(',').map(Number);
  const deer: Deer[] = [];

  for (const d of ecosystem.deer) {
    const deerCell = getCell(d);
    const [deerX, deerY] = deerCell.split(',').map(Number);
    // Check if deer is in current or neighboring cell
    if (Math.abs(deerX - cellX) <= 1 && Math.abs(deerY - cellY) <= 1) {
      deer.push(d);
    }
  }

  return deer;
}

// Get wolves in current and neighboring grid cells
function getWolvesInNeighborhood(entity: { x: number; y: number }, ecosystem: Ecosystem): Wolf[] {
  const cell = getCell(entity);
  const [cellX, cellY] = cell.split(',').map(Number);
  const wolves: Wolf[] = [];

  for (const w of ecosystem.wolves) {
    const wolfCell = getCell(w);
    const [wolfX, wolfY] = wolfCell.split(',').map(Number);
    // Check if wolf is in current or neighboring cell
    if (Math.abs(wolfX - cellX) <= 1 && Math.abs(wolfY - cellY) <= 1) {
      wolves.push(w);
    }
  }

  return wolves;
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

// Calculate crowdedness for a tree
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

        // Only larger trees crowd smaller ones (shading effect)
        if (t.size <= tree.size) continue;

        const maxDistance = t.characteristics.SpreadDistance;
        const distanceSquared = (t.x - tree.x) ** 2 + (t.y - tree.y) ** 2;
        const maxDistanceSquared = maxDistance * maxDistance;

        if (distanceSquared < maxDistanceSquared) {
          const distance = Math.sqrt(distanceSquared);
          const proximity = (maxDistance - distance) / maxDistance;
          crowdednessSum += proximity;
        }
      }
    }
  }

  return Math.min(1, crowdednessSum);
}

// Update ecosystem
export function updateEcosystem(ecosystem: Ecosystem, precalculatedCrowdedness?: number[], immortalDeer = true, immortalWolf = true) {
  const newTrees: Tree[] = [];

  // ===== TREE UPDATES =====
  ecosystem.trees = ecosystem.trees.filter((tree, treeIndex) => {
    tree.age += 1;

    // Growth: grow by 1 per tick (modified by moisture fitness) until reaching MaxSize
    if (tree.size < tree.characteristics.MaxSize) {
      const moistureFitness = getMoistureFitness(tree, ecosystem);
      const crowd = precalculatedCrowdedness
        ? precalculatedCrowdedness[treeIndex]
        : crowdedness(tree, ecosystem);

      // Base growth of 1, modified by moisture and crowding
      let growth = 1.0 * moistureFitness;

      // Crowding reduces growth with a hard minimum effect
      if (crowd > 0) {
        // Normalize susceptibility to 0-1 range
        const normalizedSusceptibility = (tree.characteristics.CrowdingSusceptibility - TREE_BOUNDS.CrowdingSusceptibility.min) /
          (TREE_BOUNDS.CrowdingSusceptibility.max - TREE_BOUNDS.CrowdingSusceptibility.min);

        // Calculate crowding effect: minimum reduction + additional reduction based on susceptibility
        const maxAdditionalReduction = 1.0 - MIN_CROWDING_GROWTH_REDUCTION;
        const crowdingEffect = MIN_CROWDING_GROWTH_REDUCTION + maxAdditionalReduction * normalizedSusceptibility;

        growth *= (1 - crowd * crowdingEffect);
      }

      tree.size = Math.min(tree.characteristics.MaxSize, tree.size + Math.max(0, growth));

      // Death from crowding with hard minimum effect
      if (crowd > 0) {
        // Normalize susceptibility to 0-1 range
        const normalizedSusceptibility = (tree.characteristics.CrowdingSusceptibility - TREE_BOUNDS.CrowdingSusceptibility.min) /
          (TREE_BOUNDS.CrowdingSusceptibility.max - TREE_BOUNDS.CrowdingSusceptibility.min);

        // Calculate death multiplier: minimum effect + additional effect based on susceptibility
        const maxAdditionalMultiplier = 1.0 - MIN_CROWDING_DEATH_MULTIPLIER;
        const deathMultiplier = MIN_CROWDING_DEATH_MULTIPLIER + maxAdditionalMultiplier * normalizedSusceptibility;

        const crowdedDeathChance = TREE_CROWDED_DEATH_BASE * crowd * deathMultiplier;
        if (Math.random() < crowdedDeathChance) {
          deleteFromGrid(ecosystem, tree);
          return false;
        }
      }
    }

    // Natural death
    if (Math.random() < tree.characteristics.DeathChance) {
      deleteFromGrid(ecosystem, tree);
      return false;
    }

    // Reproduction: if old enough and random chance succeeds
    if (tree.age > tree.characteristics.AgeToSpread) {
      const moistureFitness = getMoistureFitness(tree, ecosystem);
      const spreadChance = tree.characteristics.SpreadChance * moistureFitness;

      if (Math.random() < spreadChance) {
        const newLoc = newLocation(tree);
        if (newLoc != null) {
          const newTree: Tree = {
            id: treeIdGenerator.next(),
            x: newLoc[0],
            y: newLoc[1],
            age: 0,
            size: 0,
            // Clone parent characteristics exactly (no mutation)
            characteristics: { ...tree.characteristics }
          };
          newTrees.push(newTree);
        }
      }
    }

    return true;
  });

  // Add new trees to ecosystem
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

  // ===== DEER UPDATES =====
  const newDeer: Deer[] = [];

  ecosystem.deer = ecosystem.deer.filter((deer) => {
    deer.age += 1;

    // Movement priority: 1) seek food if hungry, 2) flee wolves if not hungry, 3) random
    if (deer.energy < DEER_REPRODUCE_THRESHOLD) {
      // Hungry - look for nearby edible trees
      const nearbyTrees = getTreesInNeighborhood(deer, ecosystem);
      let targetTree: Tree | null = null;
      let closestDistance = Infinity;

      for (const tree of nearbyTrees) {
        if (tree.size <= deer.characteristics.MaxEatableSize) {
          const distance = Math.sqrt((tree.x - deer.x) ** 2 + (tree.y - deer.y) ** 2);
          if (distance < closestDistance) {
            closestDistance = distance;
            targetTree = tree;
          }
        }
      }

      if (targetTree) {
        // Move toward target
        const dx = targetTree.x - deer.x;
        const dy = targetTree.y - deer.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        deer.x += (dx / distance) * deer.characteristics.Speed;
        deer.y += (dy / distance) * deer.characteristics.Speed;
      } else {
        // Random movement if no food found
        const angle = Math.random() * Math.PI * 2;
        deer.x += Math.cos(angle) * deer.characteristics.Speed;
        deer.y += Math.sin(angle) * deer.characteristics.Speed;
      }
    } else {
      // Not hungry - check for nearby wolves
      const nearbyWolves = getWolvesInNeighborhood(deer, ecosystem);
      let nearestWolf: Wolf | null = null;
      let closestWolfDistance = Infinity;

      for (const wolf of nearbyWolves) {
        if (wolf.id === deer.id) continue; // Skip self (shouldn't happen but defensive)
        const distance = Math.sqrt((wolf.x - deer.x) ** 2 + (wolf.y - deer.y) ** 2);
        if (distance < closestWolfDistance) {
          closestWolfDistance = distance;
          nearestWolf = wolf;
        }
      }

      if (nearestWolf) {
        // Flee from nearest wolf
        const dx = deer.x - nearestWolf.x;
        const dy = deer.y - nearestWolf.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 0) {
          deer.x += (dx / distance) * deer.characteristics.Speed;
          deer.y += (dy / distance) * deer.characteristics.Speed;
        } else {
          // If exactly on top of wolf, move in random direction
          const angle = Math.random() * Math.PI * 2;
          deer.x += Math.cos(angle) * deer.characteristics.Speed;
          deer.y += Math.sin(angle) * deer.characteristics.Speed;
        }
      } else {
        // Random movement when not hungry and no wolves nearby
        const angle = Math.random() * Math.PI * 2;
        deer.x += Math.cos(angle) * deer.characteristics.Speed;
        deer.y += Math.sin(angle) * deer.characteristics.Speed;
      }
    }

    // Wrap around edges
    deer.x = (deer.x + 1) % 1;
    deer.y = (deer.y + 1) % 1;

    // Eating: consume nearby trees if hungry and below max energy
    if (deer.energy < DEER_MAX_ENERGY) {
      for (let i = ecosystem.trees.length - 1; i >= 0; i--) {
        const tree = ecosystem.trees[i];
        const distance = Math.sqrt((tree.x - deer.x) ** 2 + (tree.y - deer.y) ** 2);

        if (distance < DEER_EATING_RADIUS_BASE * ECOSYSTEM_SCALE && tree.size <= deer.characteristics.MaxEatableSize) {
          // Eat the tree - gain energy proportional to tree size
          deleteFromGrid(ecosystem, tree);
          ecosystem.trees.splice(i, 1);
          deer.energy = Math.min(DEER_MAX_ENERGY, deer.energy + tree.size * 0.1);
          break; // Only eat one tree per tick
        }
      }
    }

    // Energy decay
    deer.energy = Math.max(0, deer.energy - deer.characteristics.EnergyNeeds);

    // Count nearby deer for crowding
    let nearbyDeer = 0;
    for (const other of ecosystem.deer) {
      if (other.id === deer.id) continue;
      const distance = Math.sqrt((other.x - deer.x) ** 2 + (other.y - deer.y) ** 2);
      if (distance < DEER_CROWDING_RADIUS_BASE * ECOSYSTEM_SCALE) {
        nearbyDeer++;
      }
    }

    // Death: base chance + crowding penalty + starvation
    let deathChance = deer.characteristics.DeathChance;
    deathChance += nearbyDeer * DEER_CROWDING_DEATH_PENALTY * deer.characteristics.CrowdingSusceptibility;

    // Starvation increases death chance
    if (deer.energy < 0.3) {
      deathChance += (0.3 - deer.energy) * 0.01;
    }

    // Prevent extinction: last deer never dies (if immortal flag is set)
    const isLastDeer = ecosystem.deer.length === 1
    const shouldPreventDeath = immortalDeer && isLastDeer
    if (!shouldPreventDeath && Math.random() < deathChance) {
      return false;
    }

    // Reproduction: if old enough and energy above threshold
    if (deer.age > DEER_REPRODUCE_AGE && deer.energy >= DEER_REPRODUCE_THRESHOLD) {
      if (Math.random() < deer.characteristics.ReproduceChance) {
        const babyDeer: Deer = {
          id: deerIdGenerator.next(),
          x: deer.x + (Math.random() - 0.5) * 0.05,
          y: deer.y + (Math.random() - 0.5) * 0.05,
          age: 0,
          energy: 1.0,
          // Clone parent characteristics exactly (no mutation)
          characteristics: { ...deer.characteristics }
        };
        newDeer.push(babyDeer);
        deer.energy -= DEER_REPRODUCTION_COST;
      }
    }

    return true;
  });

  ecosystem.deer.push(...newDeer);

  // ===== WOLF UPDATES =====
  const newWolves: Wolf[] = [];

  ecosystem.wolves = ecosystem.wolves.filter((wolf) => {
    wolf.age += 1;

    // Movement: toward prey if hungry, random otherwise
    if (wolf.energy < WOLF_REPRODUCE_THRESHOLD) {
      // Hunt for nearby deer in grid neighborhood
      const nearbyDeer = getDeerInNeighborhood(wolf, ecosystem);
      let targetDeer: Deer | null = null;
      let closestDistance = Infinity;

      for (const deer of nearbyDeer) {
        const distance = Math.sqrt((deer.x - wolf.x) ** 2 + (deer.y - wolf.y) ** 2);
        if (distance < closestDistance) {
          closestDistance = distance;
          targetDeer = deer;
        }
      }

      if (targetDeer) {
        // Chase target
        const dx = targetDeer.x - wolf.x;
        const dy = targetDeer.y - wolf.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        wolf.x += (dx / distance) * wolf.characteristics.Speed;
        wolf.y += (dy / distance) * wolf.characteristics.Speed;
      } else {
        // Random movement
        const angle = Math.random() * Math.PI * 2;
        wolf.x += Math.cos(angle) * wolf.characteristics.Speed;
        wolf.y += Math.sin(angle) * wolf.characteristics.Speed;
      }
    } else {
      // Random movement when not hungry
      const angle = Math.random() * Math.PI * 2;
      wolf.x += Math.cos(angle) * wolf.characteristics.Speed;
      wolf.y += Math.sin(angle) * wolf.characteristics.Speed;
    }

    // Wrap around edges
    wolf.x = (wolf.x + 1) % 1;
    wolf.y = (wolf.y + 1) % 1;

    // Hunting: kill nearby deer if hungry and below max energy
    if (wolf.energy < WOLF_MAX_ENERGY) {
      for (let i = ecosystem.deer.length - 1; i >= 0; i--) {
        const deer = ecosystem.deer[i];
        const distance = Math.sqrt((deer.x - wolf.x) ** 2 + (deer.y - wolf.y) ** 2);

        if (distance < WOLF_KILL_RADIUS_BASE * ECOSYSTEM_SCALE) {
          // Prevent deer extinction: don't kill last deer
          if (ecosystem.deer.length === 1) {
            break;
          }

          // Hunt success
          if (Math.random() < WOLF_HUNT_SUCCESS_BASE) {
            ecosystem.deer.splice(i, 1);
            // Gain energy proportional to deer size
            const energyGain = deer.characteristics.MaxSize * 0.3;
            wolf.energy = Math.min(WOLF_MAX_ENERGY, wolf.energy + energyGain);
            break; // Only kill one deer per tick
          }
        }
      }
    }

    // Energy decay
    wolf.energy = Math.max(0, wolf.energy - wolf.characteristics.EnergyNeeds);

    // Count nearby wolves for crowding
    let nearbyWolves = 0;
    for (const other of ecosystem.wolves) {
      if (other.id === wolf.id) continue;
      const distance = Math.sqrt((other.x - wolf.x) ** 2 + (other.y - wolf.y) ** 2);
      if (distance < WOLF_CROWDING_RADIUS_BASE * ECOSYSTEM_SCALE) {
        nearbyWolves++;
      }
    }

    // Death: base chance + crowding penalty + starvation
    let deathChance = wolf.characteristics.DeathChance;
    deathChance += nearbyWolves * WOLF_CROWDING_DEATH_PENALTY * wolf.characteristics.CrowdingSusceptibility;

    // Starvation increases death chance
    if (wolf.energy < 0.3) {
      deathChance += (0.3 - wolf.energy) * 0.01;
    }

    // Prevent extinction: last wolf never dies (if immortal flag is set)
    const isLastWolf = ecosystem.wolves.length === 1
    const shouldPreventWolfDeath = immortalWolf && isLastWolf
    if (!shouldPreventWolfDeath && Math.random() < deathChance) {
      return false;
    }

    // Reproduction: if old enough and energy above threshold
    if (wolf.age > WOLF_REPRODUCE_AGE && wolf.energy >= WOLF_REPRODUCE_THRESHOLD) {
      if (Math.random() < wolf.characteristics.ReproduceChance) {
        const babyWolf: Wolf = {
          id: wolfIdGenerator.next(),
          x: wolf.x + (Math.random() - 0.5) * 0.05,
          y: wolf.y + (Math.random() - 0.5) * 0.05,
          age: 0,
          energy: 1.5,
          // Clone parent characteristics exactly (no mutation)
          characteristics: { ...wolf.characteristics }
        };
        newWolves.push(babyWolf);
        wolf.energy -= WOLF_REPRODUCTION_COST;
      }
    }

    return true;
  });

  ecosystem.wolves.push(...newWolves);
}

// Helper: generate new location for tree spreading
function newLocation(tree: Tree): [number, number] | null {
  const dist = tree.characteristics.SpreadDistance;
  const angle = Math.random() * 2 * Math.PI;
  const newX = tree.x + Math.cos(angle) * dist * Math.random();
  const newY = tree.y + Math.sin(angle) * dist * Math.random();

  if (newX > 1 || newX < 0 || newY > 1 || newY < 0) {
    return null;
  }
  return [newX, newY];
}

const DEATH_CHANCE = 0.005;
const CROWDED_DEATH_CHANCE = 0.1;

class IdGenerator {
  private counter = 0;

  next(): number {
    return this.counter++;
  }
}

export const treeIdGenerator = new IdGenerator();

export function initializeEcosystem(): Ecosystem {
  const numTreesPerSpecies = 5;
  const trees: Tree[] = [];
  const grid: Map<string, Tree[]> = new Map();
  let cell: string;
  ["Pine" as TreeSpecies, "Maple" as TreeSpecies, "Oak" as TreeSpecies].forEach(
    (species) => {
      for (let i = 0; i < numTreesPerSpecies; i++) {
        const tree = {
          id: treeIdGenerator.next(),
          species,
          x: Math.random(),
          y: Math.random(),
          age: 0,
          size: 0,
        };
        trees.push(tree);
        cell = getCell(tree);
        grid.set(cell, [...(grid.get(cell) || []), tree]);
      }
    }
  );
  return {
    trees,
    grid,
    deer: [],
  };
}

export function updateEcosystem(ecosystem: Ecosystem) {
  const newTrees: Tree[] = [];
  ecosystem.trees = ecosystem.trees.filter((tree) => {
    tree.age += 1;
    const props = TreeSpeciesProps[tree.species]; // Cache property lookup

    if (Math.random() < 1 - crowdedness(tree, ecosystem)) {
      tree.size = Math.min(props.maxSize, tree.size + 1);
    } else {
      if (Math.random() < CROWDED_DEATH_CHANCE) {
        deleteFromGrid(ecosystem, tree);
        return false;
      }
    }
    if (Math.random() < DEATH_CHANCE) {
      deleteFromGrid(ecosystem, tree);
      return false;
    }
    if (
      tree.age > props.ageToSpread &&
      Math.random() < props.spreadChance
    ) {
      const newLoc = newLocation(tree, props);
      if (newLoc != null) {
        const newTree = {
          id: treeIdGenerator.next(),
          species: tree.species,
          x: newLoc[0],
          y: newLoc[1],
          age: 0,
          size: 0,
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
}

function deleteFromGrid(ecosystem: Ecosystem, tree: Tree) {
  const cellKey = getCell(tree);
  const cell = ecosystem.grid.get(cellKey);
  if (!cell) return;

  // Find and remove by index instead of filter
  const index = cell.findIndex((t) => t.id === tree.id);
  if (index !== -1) {
    cell.splice(index, 1);
  }
}
/*
This produces a [0,1] value, a probability of being crowded. Trees larger than the target tree contribute to the value.
the distance from which larger trees will contribute is higher if the size difference is larger.
*/
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
        if (t.id === tree.id || t.size <= tree.size) {
          continue;
        }

        const sizeDiff = (t.size - tree.size) / TreeSpeciesProps[t.species].maxSize;
        const maxDistance =
          TreeSpeciesProps[tree.species].spreadDistance * sizeDiff;

        // Use squared distance to avoid expensive sqrt
        const distanceSquared = (t.x - tree.x) ** 2 + (t.y - tree.y) ** 2;
        const maxDistanceSquared = maxDistance * maxDistance;

        if (distanceSquared < maxDistanceSquared) {
          // Each tree contributes up to ~0.3-0.4, so need 3-4 trees for full effect
          const distance = Math.sqrt(distanceSquared);
          const proximity = (maxDistance - distance) / maxDistance;
          crowdednessSum += proximity * 0.35;
        }
      }
    }
  }
  return Math.min(1, crowdednessSum);
}

function newLocation(tree: Tree, props: TreeSpeciesPropsType): [number, number] | null {
  const dist = props.spreadDistance;
  const newX = tree.x + Math.random() * 2 * dist - dist;
  const newY = tree.y + Math.random() * 2 * dist - dist;
  if (newX > 1 || newX < 0 || newY > 1 || newY < 0) {
    return null;
  }
  return [newX, newY];
}

export type TreeSpecies = "Pine" | "Maple" | "Oak";

export type TreeSpeciesPropsType = {
  name: TreeSpecies;
  ageToSpread: number;
  maxSize: number;
  spreadChance: number;
  spreadDistance: number;
  color: number;
};

export const TreeSpeciesProps: Record<TreeSpecies, TreeSpeciesPropsType> = {
  Pine: {
    name: "Pine",
    ageToSpread: 5,
    maxSize: 15,
    spreadChance: 0.15,
    spreadDistance: 0.1,
    color: 0x4e5f6f, // Dark bluish-green
  },
  Maple: {
    name: "Maple",
    ageToSpread: 8,
    maxSize: 15,
    spreadChance: 0.25,
    spreadDistance: 0.15,
    color: 0x44cc44, // Bright green
  },
  Oak: {
    name: "Oak",
    ageToSpread: 12,

    maxSize: 20,
    spreadChance: 0.20,
    spreadDistance: 0.2,
    color: 0x8b3a3a, // Dark reddish
  },
};

export type Tree = {
  species: TreeSpecies;
  id: number;
  x: number;
  y: number;
  age: number;
  size: number;
};

export function getCell(tree: Tree): string {
  const x = Math.floor(tree.x * 10);
  const y = Math.floor(tree.y * 10);
  return `${x},${y}`;
}

export type Deer = {
  id: number;
  x: number;
  y: number;
  age: number;
};

export type Ecosystem = {
  trees: Tree[];
  grid: Map<string, Tree[]>;
  deer: Deer[];
};

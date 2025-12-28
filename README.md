# game

export type TreeCharacteristics = {
  MaxSize: number; // size that the tree stops growing. size starts at 1 and increments each tick to the max. 
  AgeToSpread: number; //age the tree must be at which is starts having chance to spread
  SpreadDistance: number; // euclidean maximum distance the tree plants a new sprout
  DeathChance: number; // chance each tick that the tree will die.
  SpreadChance: number; //chance each tick that an optimally-moistured tree of sufficient age and zero crowding will produce a sprout
  OptimalMoisture: number; // 0-1, relates to moisture level in the grid which is also 0-1 per tile. if tree's grid is within 0.1 of optimal, no effect. if outside, it linearly affects increased death chance and reduced grow chance.
  CrowdingSusceptibility: number; // modifier that increases/decreases the severity of the effect of crowding on the tree's growth (reduced chance to grow in size if crowded) and death (increased death chance if crowded)
};

export type DeerCharacteristics = {
  MaxSize: number; // size that the deer stops growing. same as tree.
  Speed: number; // euclidean maximum distance the deer can move. it moves a uniform random distance to this amount each tick. priority is away from the nearest wolf; next is, if hungry, toward the nearest food that is below or at the maxeatable size, otherwise randomly.
  DeathChance: number; // chance each tick that the deer will die.
  ReproduceChance: number; // chance each tick that the deer will reproduce, if energy above threshold.
  CrowdingSusceptibility: // modifier that increases/decreases the severity of the effect of crowding: death chance increased if crowded.
  MaxEatableSize: number; // maximum tree size that the deer will eat.
  EnergyNeeds: number; // amount that energy decreases each tick. minimum is zero. if energy is 0, death chance is x3

};

export type WolfCharacteristics = {
  MaxSize: number; size that the wolf stops growing. same as tree.
  Speed: number; euclidean maximum distance the wolf can move. it moves a uniform random distance to this amount each tick. if energy below threshold, moves toward nearest deer; otherwise randomly.
  DeathChance: number; // chance of death each tick
  ReproduceChance: number; // chance to reproduce each tick, if above energy threshold
  CrowdingSusceptibility: number; // modifier that ncreases/decreases the severity of the effect of crowding: death chance increased if crowded.
  EnergyNeeds: number; // amount that energy decreases each tick. minimum is zero. if energy is 0, death chance is x3
};
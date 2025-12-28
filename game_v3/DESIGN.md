# Game V3: Simplified Ecosystem with Fixed Characteristics

## Overview
Game V3 removes mutations and simplifies interaction rules. Each entity has fixed characteristics (offspring are clones), with emergent behavior arising from the distribution of characteristics in the population rather than evolution.

## Core Changes from V2

### What Changed
- **No mutations**: Offspring inherit parent characteristics exactly (perfect clones)
- **Simplified characteristics**: New set of characteristics focused on direct gameplay mechanics
- **Direct rules**: Each characteristic has clear, simple effects on behavior
- **Removed configurable parameters**: All balance values are constants in the code

### What Stayed
- **Terrain/moisture system**: Trees still have optimal moisture preferences
- **Energy system**: Deer and wolves track energy for eating/reproduction
- **Spatial grid optimization**: Grid-based neighbor lookups for performance
- **Three-species ecosystem**: Trees, deer, wolves with predator-prey dynamics

---

## Characteristics

### Trees
All characteristics are initialized with uniform random values in their ranges:

| Characteristic | Min | Max | Description |
|---|---|---|---|
| **MaxSize** | 5 | 25 | Maximum size the tree can grow to |
| **AgeToSpread** | 3 | 20 | Age when tree can start reproducing |
| **SpreadDistance** | 0.03 | 0.15 | How far seeds spread (scaled by ECOSYSTEM_SCALE) |
| **DeathChance** | 0.001 | 0.03 | Base probability of death per tick |
| **SpreadChance** | 0.05 | 0.3 | Base probability of reproduction per tick when mature |
| **OptimalMoisture** | 0 | 1 | Moisture level (0-1) where tree thrives best |
| **CrowdingSusceptibility** | 0.2 | 1.5 | Multiplier for how affected by crowding (higher = worse) |

### Deer
| Characteristic | Min | Max | Description |
|---|---|---|---|
| **MaxSize** | 2 | 5 | Visual size (fixed, no growth) |
| **Speed** | 0.003 | 0.015 | Movement distance per tick (scaled by ECOSYSTEM_SCALE) |
| **DeathChance** | 0.00001 | 0.0005 | Base probability of death per tick |
| **ReproduceChance** | 0.1 | 0.8 | Probability of reproduction per tick when energy ≥ 1.0 |
| **CrowdingSusceptibility** | 0.5 | 2.0 | Multiplier for crowding death penalty |
| **SearchFoodRadius** | 0.05 | 0.2 | How far deer can see edible trees (scaled by ECOSYSTEM_SCALE) |
| **MaxEatableSize** | 2 | 8 | Maximum tree size deer can eat |
| **EnergyNeeds** | 0.05 | 0.2 | Energy decay per tick |

### Wolves
| Characteristic | Min | Max | Description |
|---|---|---|---|
| **MaxSize** | 2.5 | 6 | Visual size (fixed, no growth) |
| **Speed** | 0.008 | 0.025 | Movement distance per tick (scaled by ECOSYSTEM_SCALE) |
| **DeathChance** | 0.00001 | 0.0005 | Base probability of death per tick |
| **ReproduceChance** | 0.05 | 0.4 | Probability of reproduction per tick when energy ≥ 1.0 |
| **HuntRadius** | 0.1 | 0.3 | How far wolves can detect prey (scaled by ECOSYSTEM_SCALE) |
| **CrowdingSusceptibility** | 0.5 | 2.0 | Multiplier for crowding death penalty |
| **EnergyNeeds** | 0.03 | 0.15 | Energy decay per tick |

---

## Interaction Rules

### Trees

**Each Tick:**

1. **Age**: Increment age by 1

2. **Growth**: If size < MaxSize:
   - Calculate moisture fitness: `1 - 2 × |actual_moisture - OptimalMoisture|` (clamped to [0,1])
   - Calculate crowding: Sum of proximity values from larger nearby trees
   - Growth amount = `1.0 × moisture_fitness × (1 - crowding × CrowdingSusceptibility)`
   - Increase size by growth amount (capped at MaxSize)

3. **Crowding Death**: If crowded:
   - Death chance = `0.5 × crowding × CrowdingSusceptibility`
   - Die if random < death chance

4. **Natural Death**:
   - Die if random < DeathChance

5. **Reproduction**: If age > AgeToSpread:
   - Effective spread chance = `SpreadChance × moisture_fitness`
   - If random < spread chance:
     - Spawn offspring at random location within SpreadDistance
     - Offspring is exact clone (all characteristics copied)

### Deer

**Each Tick:**

1. **Age**: Increment age by 1

2. **Movement**:
   - If energy < 1.0 (reproduction threshold):
     - Look for nearest tree within SearchFoodRadius where tree.size ≤ MaxEatableSize
     - If found, move Speed distance toward it
     - Else move randomly
   - If energy ≥ 1.0:
     - Move randomly

3. **Eating**: If energy < 2.0 (max energy):
   - Check all trees within eating radius (0.03)
   - If tree.size ≤ MaxEatableSize:
     - Eat tree (remove it)
     - Gain energy: `tree.size × 0.1`
     - Cap energy at 2.0
     - Only eat one tree per tick

4. **Energy Decay**:
   - Lose EnergyNeeds from energy each tick
   - Energy cannot go below 0

5. **Crowding**:
   - Count nearby deer within radius 0.15
   - Crowding death penalty = `nearby_count × 0.002 × CrowdingSusceptibility`

6. **Death**:
   - Base death = DeathChance
   - Add crowding penalty
   - If energy < 0.3: add starvation penalty = `(0.3 - energy) × 0.01`
   - Die if random < total death chance
   - Exception: Last deer never dies (extinction prevention)

7. **Reproduction**: If age > 10 AND energy ≥ 1.0:
   - If random < ReproduceChance:
     - Spawn baby deer nearby (offset ±0.05)
     - Baby is exact clone with energy = 1.0
     - Parent loses 0.5 energy

### Wolves

**Each Tick:**

1. **Age**: Increment age by 1

2. **Movement**:
   - If energy < 1.0 (reproduction threshold):
     - Look for nearest deer within HuntRadius
     - If found, move Speed distance toward it
     - Else move randomly
   - If energy ≥ 1.0:
     - Move randomly

3. **Hunting**: If energy < 2.5 (max energy):
   - Check all deer within kill radius (0.035)
   - If deer found:
     - 70% chance to kill deer
     - Remove deer
     - Gain energy: `deer.MaxSize × 0.3`
     - Cap energy at 2.5
     - Only kill one deer per tick
   - Exception: Last deer is never killed (prey extinction prevention)

4. **Energy Decay**:
   - Lose EnergyNeeds from energy each tick
   - Energy cannot go below 0

5. **Crowding**:
   - Count nearby wolves within radius 0.3
   - Crowding death penalty = `nearby_count × 0.006 × CrowdingSusceptibility`

6. **Death**:
   - Base death = DeathChance
   - Add crowding penalty
   - If energy < 0.3: add starvation penalty = `(0.3 - energy) × 0.01`
   - Die if random < total death chance
   - Exception: Last wolf never dies (extinction prevention)

7. **Reproduction**: If age > 5 AND energy ≥ 1.0:
   - If random < ReproduceChance:
     - Spawn baby wolf nearby (offset ±0.05)
     - Baby is exact clone with energy = 1.5
     - Parent loses 0.6 energy

---

## Color Encoding

Colors visualize characteristic values to identify distinct "types" in the population.

### Trees (Green Tones)
- **Hue** (90-150°): Based on OptimalMoisture (0=yellow-green, 1=blue-green)
- **Saturation** (40-90%): Based on SpreadChance (higher=more vibrant)
- **Lightness** (25-55%): Based on CrowdingSusceptibility (higher=darker)

### Deer (Brown/Tan Tones)
- **Hue** (25-45°): Based on Speed
- **Saturation** (15-60%): Based on ReproduceChance
- **Lightness** (30-60%): Based on CrowdingSusceptibility (higher=darker)

### Wolves (Grey Tones)
- **Hue** (200-240°): Based on HuntRadius
- **Saturation** (5-25%): Based on ReproduceChance
- **Lightness** (20-45%): Based on Speed

---

## Constants

### World
- **Grid Size**: 20×20 cells
- **Ecosystem Scale**: 0.5 (all distances multiplied by this)
- **Initial Population**: 500 trees, 100 deer, 4 wolves

### Interaction Radii
- **Deer Eating Radius**: 0.03 (scaled)
- **Deer Crowding Radius**: 0.15 (scaled)
- **Wolf Kill Radius**: 0.035 (scaled)
- **Wolf Crowding Radius**: 0.3 (scaled)

### Energy
- **Deer Max Energy**: 2.0
- **Deer Reproduce Threshold**: 1.0
- **Deer Reproduce Age**: 10
- **Deer Reproduction Cost**: 0.5
- **Wolf Max Energy**: 2.5
- **Wolf Reproduce Threshold**: 1.0
- **Wolf Reproduce Age**: 5
- **Wolf Reproduction Cost**: 0.6
- **Wolf Hunt Success**: 70%

### Death Penalties
- **Deer Crowding Death Penalty**: 0.002 per nearby deer
- **Wolf Crowding Death Penalty**: 0.006 per nearby wolf
- **Tree Crowded Death Base**: 0.5
- **Starvation Penalty**: 0.01 per energy below 0.3

---

## Emergent Dynamics

### Tree "Species"
Different characteristic combinations create distinct ecological niches:
- **Fast spreaders**: High SpreadChance, low AgeToSpread → colonize empty space quickly
- **Specialists**: Narrow OptimalMoisture range → dominate specific moisture zones
- **Generalists**: Low CrowdingSusceptibility → survive in dense forests
- **Pioneers**: Small MaxSize, high SpreadChance → thrive in disturbed areas
- **Climax**: Large MaxSize, low CrowdingSusceptibility → dominate mature forests

### Deer "Types"
- **Fast foragers**: High Speed, large SearchFoodRadius → cover more ground
- **Efficient grazers**: Low EnergyNeeds → survive on less food
- **Browsers**: High MaxEatableSize → can eat wider range of trees
- **Prolific breeders**: High ReproduceChance → boom-bust dynamics
- **Hardy survivors**: Low CrowdingSusceptibility → tolerate crowding better

### Wolf "Types"
- **Wide hunters**: Large HuntRadius → find prey from afar
- **Fast chasers**: High Speed → catch prey more effectively
- **Efficient predators**: Low EnergyNeeds → survive lean times
- **Prolific packs**: High ReproduceChance → rapid population growth
- **Solitary hunters**: Low CrowdingSusceptibility → tolerate territorial competition

### Population Dynamics
- **Predator-prey cycles**: Wolf-deer populations oscillate
- **Spatial patterns**: Moisture creates tree diversity zones
- **Competition**: Trees compete for space via crowding
- **Resource limitation**: Deer limited by tree growth, wolves by deer population
- **Extinction prevention**: Last individual of each species cannot die

---

## Implementation Notes

### Performance Optimizations
- **Spatial grid**: Trees stored in grid cells for fast neighbor lookups
- **Lazy crowding calculation**: Only calculated when needed for growth
- **GPU support**: Optional precalculated crowdedness values can be provided

### Data Structures
```typescript
Tree = {
  id, x, y, age, size,
  characteristics: { MaxSize, AgeToSpread, SpreadDistance, DeathChance,
                     SpreadChance, OptimalMoisture, CrowdingSusceptibility }
}

Deer = {
  id, x, y, age, energy,
  characteristics: { MaxSize, Speed, DeathChance, ReproduceChance,
                     CrowdingSusceptibility, SearchFoodRadius,
                     MaxEatableSize, EnergyNeeds }
}

Wolf = {
  id, x, y, age, energy,
  characteristics: { MaxSize, Speed, DeathChance, ReproduceChance,
                     HuntRadius, CrowdingSusceptibility, EnergyNeeds }
}
```

### Cloning (No Mutation)
```typescript
// Offspring are exact copies
offspring.characteristics = { ...parent.characteristics }
```

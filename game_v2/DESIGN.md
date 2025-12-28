# Game V2: Continuous Evolution Tree Ecosystem

## Overview
Unlike V1's discrete species system, V2 implements continuous genetic variation where every tree has unique characteristic values, and offspring inherit parent traits with minor mutations. This creates emergent evolutionary dynamics without predefined species.

## Core Concept Changes from V1

### V1 System
- 3 discrete species (Pine, Maple, Oak)
- Fixed properties per species
- Offspring are identical clones

### V2 System
- No discrete species
- Each tree has 3 continuous characteristics (0.0 to 1.0)
- Offspring inherit parent characteristics ± small random variation
- Natural selection favors characteristics suited to local conditions
- Emergent "species-like" clusters may form from selection pressures

## Inheritance & Mutation
- **Inheritance**: Offspring start with parent's exact characteristic values
- **Mutation**: Each characteristic mutates by ± (0.0 to 0.05) per offspring
- **Bounds**: All values clamped to [0.0, 1.0] range
- **Visualization**: Tree color derived from characteristic values to show genetic diversity

---

# Characteristic System Proposals

## Proposal 1: Life History Strategy

### Characteristics
1. **Growth Rate** (0 = slow, 1 = fast)
2. **Reproduction Rate** (0 = few offspring, 1 = many offspring)
3. **Resilience** (0 = fragile, 1 = hardy)

### Mechanics

#### Growth Rate
- **Effect on size**: Trees reach `maxSize * (0.3 + 0.7 * growthRate)` at different rates
  - Low (0.0): Reaches 30% of max size slowly over 40+ ticks
  - High (1.0): Reaches 100% of max size quickly in ~10 ticks
- **Crowding impact**: Fast-growing trees are MORE affected by crowding (penalty * (1 + 0.5 * growthRate))
  - High growth trees need more resources, struggle when crowded
  - Slow growth trees can tolerate poor conditions

#### Reproduction Rate
- **Offspring frequency**: `baseSpreadChance * (0.5 + reproductionRate)`
  - Low (0.0): 50% of base spread chance
  - High (1.0): 150% of base spread chance
- **Maturity requirement**: `ageToSpread * (2 - reproductionRate)`
  - Low (0.0): Must wait 2x longer to reproduce
  - High (1.0): Can reproduce at minimum age
- **Energy cost**: Higher reproduction reduces max size: `baseMaxSize * (1 - 0.3 * reproductionRate)`

#### Resilience
- **Death resistance**: Base death chance multiplied by `(1 - 0.7 * resilience)`
  - Low (0.0): 100% of death chance
  - High (1.0): 30% of death chance
- **Crowding survival**: Crowded death chance multiplied by `(1 - resilience)`
  - Low (0.0): Full crowding penalty
  - High (1.0): No crowding penalty
- **Growth penalty**: Growth rate multiplied by `(1 - 0.2 * resilience)`
  - High resilience trees grow 20% slower

### Tradeoffs
- **r-strategy (fast growth + high reproduction)**: Dominates open spaces but vulnerable to crowding
- **K-strategy (slow growth + high resilience)**: Survives competition but expands slowly
- **Balanced**: Jack-of-all-trades, moderate performance everywhere
- **Emergent niches**:
  - Pioneer species: High growth + reproduction, low resilience (colonize empty space)
  - Climax species: Low growth + reproduction, high resilience (dominate mature forests)

---

## Proposal 2: Resource Allocation

### Characteristics
1. **Height Investment** (0 = short/wide, 1 = tall/narrow)
2. **Dispersal Range** (0 = local spread, 1 = far spread)
3. **Offspring Investment** (0 = few quality seeds, 1 = many seeds)

### Mechanics

#### Height Investment
- **Size multiplier**: `maxSize * (0.6 + 0.8 * heightInvestment)`
  - Low (0.0): Reaches 60% of base max size
  - High (1.0): Reaches 140% of base max size
- **Crowding power**: Taller trees cast more shade
  - In crowdedness calculation, tree size counted as `size * (1 + 0.5 * heightInvestment)`
  - Tall trees crowd neighbors more effectively
- **Wind vulnerability**: Death chance multiplied by `(1 + 0.3 * heightInvestment)`
  - Tall trees more likely to die from random events
- **Young vulnerability**: Trees below 50% max size have crowding resistance `* (1 - 0.4 * heightInvestment)`
  - Tall trees are very vulnerable when small

#### Dispersal Range
- **Spread distance**: `baseSpreadDistance * (0.5 + 1.5 * dispersalRange)`
  - Low (0.0): 50% of base spread distance (clumped growth)
  - High (1.0): 200% of base spread distance (wide exploration)
- **Success rate**: Far-flung seeds less likely to survive
  - Spread chance multiplied by `(1 - 0.3 * dispersalRange)`
  - Long-distance dispersal is risky
- **Establishment**: Seeds that land far from parent have harder time
  - If distance > 0.5 * spreadDistance, initial size is `* (1 - 0.3 * dispersalRange)`

#### Offspring Investment
- **Spread chance**: `baseSpreadChance * (0.3 + 1.4 * offspringInvestment)`
  - Low (0.0): 30% of base chance, rare seeds
  - High (1.0): 170% of base chance, frequent seeds
- **Offspring quality**: Lower investment means stronger offspring
  - Offspring start with size `baseSize * (1.5 - 0.5 * offspringInvestment)`
  - Quality seeds (low value) start larger and hardier
- **Parent cost**: More offspring drains parent
  - Parent growth rate `* (1 - 0.15 * offspringInvestment)` when reproducing age

### Tradeoffs
- **Tall + local + quality**: Dominant in local area but slow expansion
- **Short + far + quantity**: Rapid colonization but weak in competition
- **Tall + far**: Spreads and dominates but risky (dies easily young and from random events)
- **Short + local + quantity**: Creates dense thickets of related trees
- **Emergent niches**:
  - Canopy dominators: Max height, local spread, quality offspring
  - Colonizers: Medium height, max dispersal, quantity offspring
  - Understory: Low height, local, quality (survive under canopy)

---

## Proposal 3: Environmental Adaptation

### Characteristics
1. **Maturity Speed** (0 = slow developer, 1 = fast developer)
2. **Shade Tolerance** (0 = sun-loving, 1 = shade-tolerant)
3. **Competitive Aggression** (0 = passive, 1 = aggressive)

### Mechanics

#### Maturity Speed
- **Reproductive age**: `baseAgeToSpread * (2 - maturitySpeed)`
  - Low (0.0): Takes 2x as long to mature
  - High (1.0): Matures at minimum age
- **Max size reached**: Fast developers reach lower max size
  - `maxSize * (0.7 + 0.6 * (1 - maturitySpeed))`
  - Low (0.0): Reaches 130% of base max
  - High (1.0): Reaches only 70% of base max
- **Lifespan**: `baseLifespan * (1 + (1 - maturitySpeed))`
  - Fast developers die younger

#### Shade Tolerance
- **Growth penalty reduction**: When crowded, growth penalty is:
  - Sun-loving (0.0): Full growth penalty, `penalty * 1.5`
  - Shade-tolerant (1.0): Reduced penalty, `penalty * 0.3`
- **Open space bonus**: In uncrowded areas (crowdedness < 0.3):
  - Sun-loving (0.0): Growth rate `* (1 + 0.4 * (1 - shadeTolerance))`
  - Shade-tolerant (1.0): No bonus
- **Size requirement**: Shade-tolerant trees don't need to be as large to survive crowding
  - Effective size in crowding calculations: `size * (1 + 0.5 * shadeTolerance)`

#### Competitive Aggression
- **Crowding projection**: How much this tree crowds others
  - Aggressive trees count as larger in crowdedness calculations for neighbors
  - Crowding effect `* (1 + 0.6 * aggression)`
- **Resource cost**: Aggression requires energy
  - Growth rate `* (1 - 0.15 * aggression)`
  - Aggressive trees grow slower
- **Survival advantage**: When crowded by others, aggressive trees resist better
  - Crowded death chance `* (1 - 0.3 * aggression)`

### Tradeoffs
- **Fast + sun-loving + aggressive**: Dominates open spaces quickly, poor in mature forest
- **Slow + shade-tolerant + passive**: Survives under canopy, eventually outlives competitors
- **Fast + shade-tolerant**: Quick colonizer that can grow anywhere (but small and short-lived)
- **Slow + sun-loving + aggressive**: Long-lived dominant in stable clearings
- **Emergent niches**:
  - Pioneer: Fast maturity, sun-loving, low aggression (first in clearings)
  - Mid-successional: Medium maturity, medium shade tolerance, high aggression (competitive phase)
  - Climax: Slow maturity, shade-tolerant, medium aggression (stable forest)

---

## Visualization Strategy

### Color Encoding
Map the 3 characteristics to RGB color space:
- **Characteristic 1** → Red channel (0-255)
- **Characteristic 2** → Green channel (0-255)
- **Characteristic 3** → Blue channel (0-255)

This creates a visible "genetic signature" where:
- Similar trees have similar colors
- Mutations create color variations
- Emergent clusters are visually obvious
- Pure red/green/blue represent extreme single-trait specialists
- Mixed colors show balanced strategies

### Size Representation
- Circle radius based on current size (like V1)

---

## Recommended Starting Parameters

### World Settings
- Grid size: 10x10 cells (same as V1)
- Initial trees: 30-50 random trees with random characteristics
- Base values:
  - `baseMaxSize = 15`
  - `baseAgeToSpread = 8`
  - `baseSpreadChance = 0.2`
  - `baseSpreadDistance = 0.15`
  - `baseDeathChance = 0.005`
  - `baseCrowdedDeathChance = 0.1`

### Mutation Rate
- Per-characteristic mutation: `± uniform(0, 0.05)` per offspring
- This creates gradual variation without destroying parent strategy
- Occasional large shifts possible through multiple generations

---

## Comparison of Proposals

| Proposal | Complexity | Clarity | Emergent Potential |
|----------|-----------|---------|-------------------|
| 1: Life History | Medium | High | High - clear r/K selection |
| 2: Resource Allocation | High | Medium | Very High - complex spatial patterns |
| 3: Environmental Adaptation | Medium | High | High - successional dynamics |

### Recommendation
**Start with Proposal 1 (Life History Strategy)** because:
- Clear, intuitive tradeoffs (fast vs resilient)
- Well-understood biological analogy (r/K selection)
- Easier to balance and tune
- Strong emergent behavior potential
- Good foundation to build on

**Proposal 3** is also excellent for creating realistic forest succession dynamics.

**Proposal 2** is most complex but could create the most interesting spatial patterns.

---

## Implementation Notes

### Data Structure Changes
```typescript
type Tree = {
  id: number
  x: number
  y: number
  age: number
  size: number
  // NEW: characteristics (values 0-1)
  characteristics: {
    trait1: number
    trait2: number
    trait3: number
  }
}
```

### Reproduction Logic
```typescript
function createOffspring(parent: Tree): Tree {
  return {
    ...newTreeDefaults,
    characteristics: {
      trait1: clamp(parent.characteristics.trait1 + mutate(), 0, 1),
      trait2: clamp(parent.characteristics.trait2 + mutate(), 0, 1),
      trait3: clamp(parent.characteristics.trait3 + mutate(), 0, 1),
    }
  }
}

function mutate(): number {
  return (Math.random() - 0.5) * 0.1 // ± 0.05
}
```

### UI Additions
- Hovering over tree shows its characteristic values
- Statistics panel showing characteristic distribution (histogram/scatter plot)
- Optional: trait selector to highlight trees with similar values
- Optional: lineage tracker to follow genetic lines

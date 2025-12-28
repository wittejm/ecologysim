# Terrain System Design

## Goal
Add elevation/altitude to create varied microhabitats that affect tree growth and survival, adding spatial heterogeneity to forest dynamics.

## Terrain Generation

### Height Map
- Each cell in the 10x10 spatial grid has an elevation value (0-1)
- Elevation is **smooth and continuous** across cells (hills and valleys)
- Generated using overlaid sine waves:
  ```
  elevation(x, y) =
    0.5 * sin(x * 2π * 1.3) * cos(y * 2π * 0.9) +
    0.3 * sin(x * 2π * 2.7 + 1.2) * sin(y * 2π * 2.1) +
    0.2 * cos(x * 2π * 4.1 + 2.5) * cos(y * 2π * 3.8 + 0.8)

  normalized to [0, 1]
  ```
- Alternative: Sum of 3-4 sine curves with different frequencies/phases
- Result: Gentle rolling hills, no sharp cliffs

### Why This Approach?
- **Simple**: Pure mathematical function, no noise library needed
- **Deterministic**: Same terrain every run (good for testing)
- **Smooth**: Continuous gradients, realistic terrain flow
- **Varied**: Multiple frequencies create interesting landscape

## Ecological Effects

### 1. Moisture Gradient
**Concept**: Valleys collect water, peaks are drier

**Implementation**:
```
moisture(elevation) = 1.0 - elevation
  // Low elevation (0.0) = wet (1.0)
  // High elevation (1.0) = dry (0.0)
```

**Tree Response**:
- Trees have optimal moisture range based on characteristics
- Example: `optimalMoisture = tree.characteristics.resilience`
  - Low resilience trees prefer valleys (need more water)
  - High resilience trees tolerate peaks (drought-resistant)
- Growth penalty when far from optimal:
  ```
  moisturePenalty = abs(moisture - optimalMoisture)
  growth *= (1 - moisturePenalty * 0.4)
  ```

### 2. Crowding Variation by Elevation
**Concept**: Different carrying capacity at different elevations

**Implementation**:
- Trees crowd more at high elevations (harsher conditions, less space)
- Crowding multiplier: `crowdingFactor = 1.0 + elevation * 0.5`
- Applied to crowdedness calculation:
  ```
  effectiveCrowdedness = crowdedness * crowdingFactor
  ```

**Effect**: Valleys support denser forests, peaks are sparse

### 3. Reproduction Success by Altitude
**Concept**: Seedlings more vulnerable at extremes

**Implementation**:
- Reproduction chance reduced at very high/low elevations
- Optimal elevation for reproduction: 0.4 - 0.6 (mid-altitude)
- Penalty applied:
  ```
  elevationPenalty = abs(elevation - 0.5) * 2  // 0 at 0.5, 1 at extremes
  spreadChance *= (1 - elevationPenalty * 0.3)
  ```

**Effect**: Creates reproduction "sweet spot" in mid-elevations

## Visualization

### Option 1: Background Shading
- Render terrain as grayscale background
- Dark = valleys, Light = peaks
- Trees rendered on top with normal colors

### Option 2: Tree Color Tint
- Tint tree colors based on elevation
- Valleys: cooler/bluer tones
- Peaks: warmer/yellower tones
- Subtle blend with genetic color

### Option 3: No Visual (Data Only)
- Terrain affects mechanics but isn't rendered
- Users discover elevation patterns through tree distribution

**Recommendation**: Option 1 (background shading) - clearest communication

## Implementation Steps

1. **Add terrain to Ecosystem type**
   ```typescript
   type Ecosystem = {
     trees: Tree[]
     deer: Deer[]
     grid: Map<string, Tree[]>
     terrain: number[][]  // 10x10 elevation grid
   }
   ```

2. **Generate terrain in initializeEcosystem()**
   ```typescript
   function generateTerrain(): number[][] {
     const terrain: number[][] = []
     for (let x = 0; x < 10; x++) {
       terrain[x] = []
       for (let y = 0; y < 10; y++) {
         terrain[x][y] = calculateElevation(x/10, y/10)
       }
     }
     return terrain
   }
   ```

3. **Helper function to get elevation at position**
   ```typescript
   function getElevation(ecosystem: Ecosystem, x: number, y: number): number {
     const cellX = Math.floor(x * 10)
     const cellY = Math.floor(y * 10)
     return ecosystem.terrain[cellX][cellY]
   }
   ```

4. **Modify growth calculation**
   - Get tree's elevation
   - Calculate moisture from elevation
   - Apply moisture penalty to growth
   - Apply elevation penalty to reproduction

5. **Modify crowdedness calculation**
   - Get elevation at tree position
   - Multiply crowdedness by crowding factor

6. **Add terrain rendering** (optional)
   - Draw filled rectangles for each cell
   - Color based on elevation (grayscale)
   - Render before trees layer

## Expected Dynamics

### Spatial Patterns
- **Valleys**: Dense forests, high competition, high turnover
- **Mid-slopes**: Optimal reproduction, balanced growth
- **Peaks**: Sparse, hardy trees, low turnover

### Evolutionary Pressure
- **Resilience trait**: Strong selection gradient by elevation
  - High resilience evolves on peaks (drought tolerance)
  - Low resilience in valleys (water abundance)
- **Spatial niche partitioning**: Different tree types dominate different elevations

### Deer Interaction
- Deer movement unchanged (terrain doesn't affect movement)
- Deer concentrate in valleys (higher tree density = more food)
- Creates predator-prey hotspots in low elevations

## Parameters to Tune

```typescript
// Terrain generation
TERRAIN_WAVE_1_FREQ = 1.3  // Large-scale hills
TERRAIN_WAVE_2_FREQ = 2.7  // Medium-scale features
TERRAIN_WAVE_3_FREQ = 4.1  // Fine-scale variation

// Ecological effects
MOISTURE_GROWTH_PENALTY = 0.4     // How much moisture mismatch hurts growth
ELEVATION_CROWDING_BONUS = 0.5    // Extra crowding at peaks
ELEVATION_REPRODUCTION_PENALTY = 0.3  // Reproduction reduction at extremes
```

## Testing Plan

1. **Visual Test**: Render terrain, verify smooth hills/valleys
2. **Distribution Test**: Run 1000 ticks, check tree density by elevation
3. **Evolution Test**: Measure resilience trait by elevation after 2000 ticks
4. **Comparison Test**: Run with/without terrain, observe population dynamics differences

## Success Criteria

- ✅ Terrain generates smoothly without artifacts
- ✅ Tree density varies visibly by elevation
- ✅ High-resilience trees concentrate on peaks over time
- ✅ Low-resilience trees concentrate in valleys over time
- ✅ Overall population dynamics remain stable (no crashes)
- ✅ Adds visual interest without overwhelming genetic color coding

## Future Extensions (Not Now)

- Temperature gradient (separate from moisture)
- Soil quality variation
- Water flow simulation (runoff from peaks to valleys)
- Elevation-dependent deer movement cost
- Seasonal effects (winter harsher at high elevation)

# WebGL2 GPU Acceleration Design

## Goal
Accelerate crowdedness calculation from O(n²) CPU to parallel GPU processing for 1000-5000 trees.

## Approach: WebGL2 Transform Feedback

### Why Transform Feedback?
WebGL2's Transform Feedback allows us to:
1. Run vertex shader for each tree (parallel execution)
2. Capture computed values directly to buffer
3. Read results back to JavaScript
4. Skip fragment shader entirely (we're computing, not rendering)

### Data Flow
```
JavaScript → GPU Buffers → Vertex Shader (parallel) → Transform Feedback → Output Buffer → JavaScript
```

## Implementation Design

### Input Data Structure
For each tree, we need:
- Position (x, y)
- Size
- Max size (from characteristics)
- Spread distance (from characteristics)
- Tree ID (to skip self-comparison)

### Shader Logic (runs once per tree in parallel)
```glsl
for each tree T being evaluated:
  crowdedness = 0

  for each other tree O in the world:
    if O.id == T.id: skip
    if O.size <= T.size: skip

    sizeRatio = O.size / O.maxSize
    maxDistance = O.spreadDistance * sizeRatio

    distance = sqrt((O.x - T.x)² + (O.y - T.y)²)

    if distance < maxDistance:
      proximity = (maxDistance - distance) / maxDistance
      crowdedness += proximity * 0.35

  return min(crowdedness, 1.0)
```

### Technical Approach

#### Problem: Shader needs to access ALL trees while processing each tree
**Solution**: Pack all tree data into a texture (random access from shader)

#### Texture Layout
```
Texture (RGBA32F):
Each pixel stores one tree: [x, y, size, maxSize]
Width = ceil(sqrt(numTrees))
Height = ceil(sqrt(numTrees))
```

#### Vertex Shader Inputs
```glsl
// Per-tree attributes (one per vertex)
in vec2 position;      // This tree's position
in float size;         // This tree's size
in float spreadDist;   // This tree's spread distance
in int treeId;         // This tree's ID

// All trees (texture)
uniform sampler2D allTreesTexture;
uniform int numTrees;
uniform int textureWidth;

// Output
out float crowdedness;
```

## Pseudocode

### Initialization
```javascript
constructor() {
  this.canvas = createElement('canvas')
  this.gl = canvas.getContext('webgl2')

  if (!this.gl) {
    this.fallbackToCPU = true
    return
  }

  this.program = compileShaders(vertexShader, fragmentShader)
  setupTransformFeedback(['crowdedness'])
}
```

### Calculate (called each tick)
```javascript
calculate(trees, getMaxSize, getSpreadDistance) {
  if (!this.gl) return null // CPU fallback

  // 1. Pack all tree data into texture
  const textureData = new Float32Array(trees.length * 4)
  for (let i = 0; i < trees.length; i++) {
    textureData[i*4 + 0] = trees[i].x
    textureData[i*4 + 1] = trees[i].y
    textureData[i*4 + 2] = trees[i].size
    textureData[i*4 + 3] = getMaxSize(trees[i])
  }

  const texture = createAndUploadTexture(textureData)

  // 2. Create input vertex buffer (per-tree data)
  const inputData = new Float32Array(trees.length * 5)
  for (let i = 0; i < trees.length; i++) {
    inputData[i*5 + 0] = trees[i].x
    inputData[i*5 + 1] = trees[i].y
    inputData[i*5 + 2] = trees[i].size
    inputData[i*5 + 3] = getSpreadDistance(trees[i])
    inputData[i*5 + 4] = i  // tree ID
  }

  uploadToBuffer(inputData)

  // 3. Create output buffer
  const outputBuffer = createBuffer(trees.length * 4)

  // 4. Execute GPU computation
  bindTransformFeedback(outputBuffer)
  gl.enable(RASTERIZER_DISCARD)  // Don't render pixels
  gl.beginTransformFeedback(POINTS)
  gl.drawArrays(POINTS, 0, trees.length)  // One point per tree
  gl.endTransformFeedback()
  gl.disable(RASTERIZER_DISCARD)

  // 5. Read results back
  const results = new Float32Array(trees.length)
  gl.getBufferSubData(outputBuffer, 0, results)

  // 6. Cleanup
  deleteTexture(texture)
  deleteBuffer(outputBuffer)

  return Array.from(results)
}
```

## Risks & Mitigations

### Risk 1: WebGL2 not available
**Mitigation**: Check for WebGL2 in constructor, set flag, return null from calculate()
**Fallback**: Caller checks for null and uses CPU version

### Risk 2: Shader compilation fails
**Mitigation**:
- Detailed error logging with gl.getShaderInfoLog()
- Return false from init(), set fallback flag
- Test shader with simple cases first

### Risk 3: Data size exceeds limits
**Mitigation**:
- Check gl.MAX_TEXTURE_SIZE (usually 8192+)
- For 5000 trees, need ~71x71 texture (well under limit)
- Add assertion: numTrees < (MAX_TEXTURE_SIZE²)

### Risk 4: Transform feedback fails silently
**Mitigation**:
- Check gl.getError() after each operation during development
- Validate output buffer has correct size
- Test with known inputs and verify outputs

### Risk 5: Precision issues with FLOAT
**Mitigation**:
- Use `precision highp float` in shader
- WebGL2 guarantees high precision on desktop GPUs
- Compare outputs with CPU version in tests

### Risk 6: Performance worse than CPU for small populations
**Mitigation**:
- Add population threshold: only use GPU if trees.length > 500
- GPU has setup overhead (buffer creation, data upload)
- CPU is faster for < 500 trees

## Abstraction Strategy

### Model Layer (model.ts)
```typescript
// NO changes to model.ts
// It stays pure, works everywhere (browser, node, headless)
```

### GPU Bridge Layer (gpu-crowdedness.ts)
```typescript
export class GPUCrowdednessCalculator {
  calculate(trees, getMaxSize, getSpreadDistance): number[] | null {
    // Returns null if GPU unavailable
  }
}
```

### Integration Layer (App.tsx - browser only)
```typescript
const gpuCalculator = useRef<GPUCrowdednessCalculator | null>(null)

useEffect(() => {
  const gpu = new GPUCrowdednessCalculator()
  if (gpu.init()) {
    gpuCalculator.current = gpu
    console.log('GPU acceleration enabled')
  }
}, [])

// In update loop:
const useCPU = !gpuCalculator.current || trees.length < 500
if (!useCPU) {
  const gpuResults = gpuCalculator.current.calculate(...)
  if (gpuResults) {
    // Use GPU results
  } else {
    // GPU failed, fall back to CPU
  }
}
```

### Headless (headless-runner.ts)
```typescript
// NO changes needed
// Never imports gpu-crowdedness.ts
// Uses model.ts directly (CPU only)
```

## Testing Regime

### Unit Tests (manual verification)

#### Test 1: GPU Initialization
```javascript
const gpu = new GPUCrowdednessCalculator()
assert(gpu.init() === true || gpu.init() === false)
// Should not crash
```

#### Test 2: Empty Input
```javascript
const results = gpu.calculate([], getMaxSize, getSpreadDistance)
assert(results === null || results.length === 0)
```

#### Test 3: Single Tree
```javascript
const tree = { x: 0.5, y: 0.5, size: 5, ... }
const results = gpu.calculate([tree], getMaxSize, getSpreadDistance)
assert(results === null || results[0] === 0)  // No other trees, no crowding
```

#### Test 4: Two Trees (far apart)
```javascript
const tree1 = { x: 0.1, y: 0.1, size: 5, ... }
const tree2 = { x: 0.9, y: 0.9, size: 10, ... }
const results = gpu.calculate([tree1, tree2], ...)
// Distance too far, no crowding
assert(results === null || (results[0] < 0.1 && results[1] === 0))
```

#### Test 5: Two Trees (close, one larger)
```javascript
const tree1 = { x: 0.5, y: 0.5, size: 3, ... }
const tree2 = { x: 0.52, y: 0.5, size: 10, ... }  // Close and larger
const results = gpu.calculate([tree1, tree2], ...)
// tree1 should be crowded, tree2 not
assert(results === null || (results[0] > 0.1 && results[1] === 0))
```

#### Test 6: CPU/GPU Parity
```javascript
// Generate 100 random trees
const trees = generateRandomTrees(100)

// Calculate on CPU
const cpuResults = trees.map((tree, i) => cpuCrowdedness(tree, i, trees))

// Calculate on GPU
const gpuResults = gpu.calculate(trees, getMaxSize, getSpreadDistance)

if (gpuResults) {
  // Compare (allow small floating-point differences)
  for (let i = 0; i < trees.length; i++) {
    assert(Math.abs(cpuResults[i] - gpuResults[i]) < 0.001)
  }
}
```

#### Test 7: Large Population (stress test)
```javascript
const trees = generateRandomTrees(5000)
const start = performance.now()
const results = gpu.calculate(trees, getMaxSize, getSpreadDistance)
const end = performance.now()

console.log(`GPU processed 5000 trees in ${end - start}ms`)
assert(results === null || results.length === 5000)
```

### Integration Test (in browser)

#### Visual Test
1. Run simulation to 1000+ trees
2. Open console, verify "GPU acceleration enabled" message
3. Check compute time stays low (<10ms at 1000 trees)
4. Verify trees still crowd/die correctly (behavior unchanged)

#### A/B Test
1. Run simulation with GPU for 500 ticks, record population history
2. Disable GPU, run same simulation, record population history
3. Compare: should be identical (or near-identical due to floating-point)

## Expected Performance

### CPU Baseline
- 100 trees: 1ms
- 500 trees: 10ms
- 1000 trees: 40ms
- 2000 trees: 160ms
- 5000 trees: 1000ms (1 second - unusable)

### GPU Target
- 100 trees: 2ms (overhead, use CPU instead)
- 500 trees: 3ms (3x faster)
- 1000 trees: 4ms (10x faster)
- 2000 trees: 6ms (25x faster)
- 5000 trees: 15ms (65x faster)

### Threshold Decision
Use GPU when: `numTrees >= 500`

## Implementation Checklist

- [ ] Write vertex shader with crowdedness logic
- [ ] Write minimal fragment shader
- [ ] Implement shader compilation with error handling
- [ ] Implement texture creation and upload
- [ ] Implement transform feedback setup
- [ ] Implement buffer creation and data upload
- [ ] Implement GPU execution
- [ ] Implement result readback
- [ ] Add cleanup/destroy method
- [ ] Test with console logs (shader compilation, execution)
- [ ] Test with small datasets (1, 2, 10 trees)
- [ ] Test CPU/GPU parity with 100 random trees
- [ ] Integrate into App.tsx with threshold
- [ ] Verify headless still works (no GPU code loaded)
- [ ] Performance test with 5000 trees
- [ ] Document usage and fallback behavior

## Success Criteria

1. ✅ Simulation runs smoothly at 5000 trees (< 20ms per tick)
2. ✅ GPU fallback to CPU is seamless (no crashes)
3. ✅ Headless mode unchanged (still works, no GPU dependencies)
4. ✅ Results are identical to CPU (within floating-point tolerance)
5. ✅ Works in Chrome, Firefox, Safari on macOS

import { GPU } from 'gpu.js';

// Type definitions
type TestTree = {
  x: number;
  y: number;
  size: number;
  maxSize: number;
  spreadDistance: number;
};

// Generate random test trees
function generateTestTrees(count: number): TestTree[] {
  const trees: TestTree[] = [];
  for (let i = 0; i < count; i++) {
    trees.push({
      x: Math.random(),
      y: Math.random(),
      size: Math.random() * 15,
      maxSize: 10 + Math.random() * 10,
      spreadDistance: 0.075 + Math.random() * 0.15
    });
  }
  return trees;
}

// CPU version - mirrors the actual game logic
function cpuCrowdedness(trees: TestTree[], targetIndex: number): number {
  const tree = trees[targetIndex];
  let crowdednessSum = 0;

  for (let i = 0; i < trees.length; i++) {
    if (i === targetIndex || trees[i].size <= tree.size) {
      continue;
    }

    const t = trees[i];
    const sizeDiff = (t.size - tree.size) / t.maxSize;
    const maxDistance = tree.spreadDistance * sizeDiff;

    const distanceSquared = (t.x - tree.x) ** 2 + (t.y - tree.y) ** 2;
    const maxDistanceSquared = maxDistance * maxDistance;

    if (distanceSquared < maxDistanceSquared) {
      const distance = Math.sqrt(distanceSquared);
      const proximity = (maxDistance - distance) / maxDistance;
      crowdednessSum += proximity * 0.35;
    }
  }

  return Math.min(1, crowdednessSum);
}

// GPU version using gpu.js
function createGpuCrowdednessKernel(gpu: GPU, numTrees: number) {
  return gpu.createKernel(function(
    xs: number[],
    ys: number[],
    sizes: number[],
    maxSizes: number[],
    spreadDistances: number[],
    targetIndex: number
  ) {
    const tree_x = xs[targetIndex];
    const tree_y = ys[targetIndex];
    const tree_size = sizes[targetIndex];
    const tree_spread = spreadDistances[targetIndex];

    let crowdednessSum = 0;

    // Each GPU thread processes one potential neighbor
    const i = this.thread.x;

    if (i !== targetIndex && sizes[i] > tree_size) {
      const sizeDiff = (sizes[i] - tree_size) / maxSizes[i];
      const maxDistance = tree_spread * sizeDiff;

      const dx = xs[i] - tree_x;
      const dy = ys[i] - tree_y;
      const distanceSquared = dx * dx + dy * dy;
      const maxDistanceSquared = maxDistance * maxDistance;

      if (distanceSquared < maxDistanceSquared) {
        const distance = Math.sqrt(distanceSquared);
        const proximity = (maxDistance - distance) / maxDistance;
        crowdednessSum = proximity * 0.35;
      }
    }

    return crowdednessSum;
  }, {
    output: [numTrees],
    pipeline: false
  });
}

// Benchmark function
function benchmark(trees: TestTree[], label: string): number {
  const start = performance.now();

  // Calculate crowdedness for all trees
  for (let i = 0; i < trees.length; i++) {
    cpuCrowdedness(trees, i);
  }

  const end = performance.now();
  const duration = end - start;

  console.log(`  ${label}: ${duration.toFixed(2)}ms`);
  return duration;
}

function gpuBenchmark(trees: TestTree[], gpu: GPU, label: string): number {
  // Prepare data arrays
  const xs = trees.map(t => t.x);
  const ys = trees.map(t => t.y);
  const sizes = trees.map(t => t.size);
  const maxSizes = trees.map(t => t.maxSize);
  const spreadDistances = trees.map(t => t.spreadDistance);

  const kernel = createGpuCrowdednessKernel(gpu, trees.length);

  const start = performance.now();

  // Calculate crowdedness for all trees
  for (let i = 0; i < trees.length; i++) {
    const result = kernel(xs, ys, sizes, maxSizes, spreadDistances, i) as number[];
    // Sum up the results (GPU returns array of contributions)
    const crowdedness = Math.min(1, result.reduce((a, b) => a + b, 0));
  }

  const end = performance.now();
  const duration = end - start;

  console.log(`  ${label}: ${duration.toFixed(2)}ms`);

  // Cleanup
  kernel.destroy();

  return duration;
}

// Main benchmark runner
async function runBenchmarks() {
  console.log('GPU Benchmark for Tree Crowdedness Calculation');
  console.log('='.repeat(60));
  console.log(`Platform: ${process.platform}`);
  console.log(`Node: ${process.version}`);
  console.log(`Arch: ${process.arch}`);
  console.log('='.repeat(60));
  console.log();

  const gpu = new GPU({ mode: 'gpu' });

  // Check if GPU is available
  if (gpu.mode === 'cpu') {
    console.log('WARNING: GPU.js fell back to CPU mode. WebGL may not be available.');
    console.log('This benchmark will still run but won\'t show true GPU performance.\n');
  } else {
    console.log(`GPU Mode: ${gpu.mode}`);
    console.log();
  }

  const populationSizes = [100, 500, 1000, 2000, 5000];
  const results: Array<{
    population: number;
    cpuTime: number;
    gpuTime: number;
    speedup: number;
  }> = [];

  for (const size of populationSizes) {
    console.log(`Testing with ${size} trees:`);

    const trees = generateTestTrees(size);

    // Warm-up run (not counted)
    cpuCrowdedness(trees, 0);

    // CPU benchmark (3 runs, take average)
    const cpuTimes: number[] = [];
    for (let run = 0; run < 3; run++) {
      cpuTimes.push(benchmark(trees, `CPU run ${run + 1}`));
    }
    const avgCpuTime = cpuTimes.reduce((a, b) => a + b, 0) / cpuTimes.length;

    // GPU benchmark (3 runs, take average)
    const gpuTimes: number[] = [];
    for (let run = 0; run < 3; run++) {
      gpuTimes.push(gpuBenchmark(trees, gpu, `GPU run ${run + 1}`));
    }
    const avgGpuTime = gpuTimes.reduce((a, b) => a + b, 0) / gpuTimes.length;

    const speedup = avgCpuTime / avgGpuTime;

    results.push({
      population: size,
      cpuTime: avgCpuTime,
      gpuTime: avgGpuTime,
      speedup: speedup
    });

    console.log(`  Average CPU: ${avgCpuTime.toFixed(2)}ms`);
    console.log(`  Average GPU: ${avgGpuTime.toFixed(2)}ms`);
    console.log(`  Speedup: ${speedup.toFixed(2)}x`);
    console.log();
  }

  // Generate summary report
  console.log('='.repeat(60));
  console.log('SUMMARY REPORT');
  console.log('='.repeat(60));
  console.log();
  console.log('Population | CPU Time  | GPU Time  | Speedup  | Time Saved');
  console.log('-'.repeat(60));

  for (const result of results) {
    const timeSaved = result.cpuTime - result.gpuTime;
    const timeSavedPercent = ((timeSaved / result.cpuTime) * 100).toFixed(1);

    console.log(
      `${result.population.toString().padStart(10)} | ` +
      `${result.cpuTime.toFixed(2).padStart(8)}ms | ` +
      `${result.gpuTime.toFixed(2).padStart(8)}ms | ` +
      `${result.speedup.toFixed(2).padStart(7)}x | ` +
      `${timeSaved.toFixed(2).padStart(8)}ms (${timeSavedPercent}%)`
    );
  }

  console.log();
  console.log('='.repeat(60));
  console.log('ANALYSIS');
  console.log('='.repeat(60));

  // Find crossover point (where GPU becomes worth it)
  const worthwhileResults = results.filter(r => r.speedup > 1.5);
  if (worthwhileResults.length > 0) {
    const crossover = worthwhileResults[0].population;
    console.log(`GPU becomes beneficial at ~${crossover} trees (1.5x+ speedup)`);
  } else {
    console.log('GPU shows no significant benefit at tested population sizes');
    console.log('(This may indicate GPU.js fell back to CPU mode)');
  }

  // Best speedup
  const bestResult = results.reduce((best, curr) =>
    curr.speedup > best.speedup ? curr : best
  );
  console.log(`Best speedup: ${bestResult.speedup.toFixed(2)}x at ${bestResult.population} trees`);

  // Estimate for larger populations
  const lastResult = results[results.length - 1];
  if (lastResult.speedup > 1) {
    const estimated10k = (lastResult.cpuTime / lastResult.population) * 10000;
    const estimatedGpu10k = (lastResult.gpuTime / lastResult.population) * 10000;
    console.log(`Estimated 10,000 trees: CPU ${estimated10k.toFixed(0)}ms vs GPU ${estimatedGpu10k.toFixed(0)}ms`);
  }

  console.log();

  // Cleanup
  gpu.destroy();
}

// Run the benchmarks
runBenchmarks().catch(console.error);

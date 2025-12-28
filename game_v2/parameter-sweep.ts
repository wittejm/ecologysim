/**
 * Parameter Sweep Script
 *
 * Runs hundreds of ecosystem simulations with different parameters
 * to find stable configurations with good oscillation dynamics.
 *
 * Usage: npx tsx parameter-sweep.ts
 */

import { initializeEcosystem, updateEcosystem, type Ecosystem, type Tree, type Deer } from './src/model/model'
import * as fs from 'fs'

// Parameter ranges to test
const PARAMETER_SPACE = {
  baseSpreadChance: [0.10, 0.15, 0.20, 0.25],
  baseCrowdedDeathChance: [0.20, 0.25, 0.30, 0.35],
  deerReproduceChance: [0.03, 0.05, 0.07],
  deerStarvationPenalty: [0.001, 0.003, 0.005],
  deerReproduceAge: [10, 15, 20],
}

const TICKS = 5000
const SAMPLE_INTERVAL = 10 // Sample population every N ticks
const CLUSTER_INTERVAL = 500 // Compute clusters every N ticks

interface PopulationSnapshot {
  tick: number
  trees: number
  deer: number
}

interface ClusterSnapshot {
  tick: number
  treeClusters: {
    count: number
    avgGrowth: number
    avgRepro: number
    avgResilience: number
  }[]
  deerClusters: {
    count: number
    avgSpeed: number
    avgAppetite: number
    avgReach: number
  }[]
}

interface SimulationResult {
  parameters: {
    baseSpreadChance: number
    baseCrowdedDeathChance: number
    deerReproduceChance: number
    deerStarvationPenalty: number
    deerReproduceAge: number
  }
  survived: boolean
  finalTick: number

  // Population metrics
  treeStats: {
    mean: number
    min: number
    max: number
    stdDev: number
    extinctionEvents: number
  }
  deerStats: {
    mean: number
    min: number
    max: number
    stdDev: number
    extinctionEvents: number
  }

  // Oscillation metrics
  oscillations: {
    treeCycles: number
    deerCycles: number
    avgTreePeriod: number
    avgDeerPeriod: number
    treeAmplitude: number
    deerAmplitude: number
  }

  // Diversity metrics
  diversity: {
    treeClusterStability: number  // 0-1, how stable are clusters
    deerClusterStability: number
    avgTreeClusters: number
    avgDeerClusters: number
  }

  // Raw time series (for detailed analysis)
  populationHistory: PopulationSnapshot[]
  clusterHistory: ClusterSnapshot[]
}

// K-means clustering (simplified version)
function kMeansSimple(
  items: { c1: number; c2: number; c3: number }[],
  k: number = 3
): { count: number; avg1: number; avg2: number; avg3: number }[] {
  if (items.length === 0) return []

  const actualK = Math.min(k, items.length)

  // Initialize centroids randomly
  const centroids: number[][] = []
  const usedIndices = new Set<number>()
  while (centroids.length < actualK) {
    const idx = Math.floor(Math.random() * items.length)
    if (!usedIndices.has(idx)) {
      usedIndices.add(idx)
      centroids.push([items[idx].c1, items[idx].c2, items[idx].c3])
    }
  }

  // Run k-means (10 iterations)
  const assignments: number[] = new Array(items.length)
  for (let iter = 0; iter < 10; iter++) {
    // Assign to nearest centroid
    for (let i = 0; i < items.length; i++) {
      const point = [items[i].c1, items[i].c2, items[i].c3]
      let minDist = Infinity
      let minIdx = 0
      for (let j = 0; j < actualK; j++) {
        const dist = Math.sqrt(
          (point[0] - centroids[j][0]) ** 2 +
          (point[1] - centroids[j][1]) ** 2 +
          (point[2] - centroids[j][2]) ** 2
        )
        if (dist < minDist) {
          minDist = dist
          minIdx = j
        }
      }
      assignments[i] = minIdx
    }

    // Update centroids
    for (let j = 0; j < actualK; j++) {
      const clusterItems = items.filter((_, i) => assignments[i] === j)
      if (clusterItems.length > 0) {
        centroids[j] = [
          clusterItems.reduce((sum, item) => sum + item.c1, 0) / clusterItems.length,
          clusterItems.reduce((sum, item) => sum + item.c2, 0) / clusterItems.length,
          clusterItems.reduce((sum, item) => sum + item.c3, 0) / clusterItems.length
        ]
      }
    }
  }

  // Get cluster stats
  const clusters: { count: number; avg1: number; avg2: number; avg3: number }[] = []
  for (let j = 0; j < actualK; j++) {
    const clusterItems = items.filter((_, i) => assignments[i] === j)
    if (clusterItems.length === 0) continue

    clusters.push({
      count: clusterItems.length,
      avg1: clusterItems.reduce((sum, item) => sum + item.c1, 0) / clusterItems.length,
      avg2: clusterItems.reduce((sum, item) => sum + item.c2, 0) / clusterItems.length,
      avg3: clusterItems.reduce((sum, item) => sum + item.c3, 0) / clusterItems.length
    })
  }

  clusters.sort((a, b) => b.count - a.count)
  return clusters
}

// Detect oscillation cycles using peak detection
function detectCycles(values: number[]): { count: number; avgPeriod: number; amplitude: number } {
  if (values.length < 10) {
    return { count: 0, avgPeriod: 0, amplitude: 0 }
  }

  // Find local maxima (peaks)
  const peaks: number[] = []
  for (let i = 1; i < values.length - 1; i++) {
    if (values[i] > values[i - 1] && values[i] > values[i + 1]) {
      peaks.push(i)
    }
  }

  // Calculate average period between peaks
  let avgPeriod = 0
  if (peaks.length > 1) {
    const periods = []
    for (let i = 1; i < peaks.length; i++) {
      periods.push(peaks[i] - peaks[i - 1])
    }
    avgPeriod = periods.reduce((a, b) => a + b, 0) / periods.length
  }

  // Calculate amplitude (std dev is a proxy)
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / values.length
  const amplitude = Math.sqrt(variance)

  return {
    count: peaks.length,
    avgPeriod: avgPeriod * SAMPLE_INTERVAL, // Convert to actual ticks
    amplitude
  }
}

// Run a single simulation with given parameters
function runSimulation(params: {
  baseSpreadChance: number
  baseCrowdedDeathChance: number
  deerReproduceChance: number
  deerStarvationPenalty: number
  deerReproduceAge: number
}): SimulationResult {
  // Initialize ecosystem with the specified parameters
  const ecosystem = initializeEcosystem(params)
  const populationHistory: PopulationSnapshot[] = []
  const clusterHistory: ClusterSnapshot[] = []

  let survived = true
  let finalTick = 0

  for (let tick = 0; tick < TICKS; tick++) {
    // Update ecosystem
    updateEcosystem(ecosystem)

    // Check for extinction
    if (ecosystem.trees.length === 0 || ecosystem.deer.length === 0) {
      survived = false
      finalTick = tick
      break
    }

    // Sample population
    if (tick % SAMPLE_INTERVAL === 0) {
      populationHistory.push({
        tick,
        trees: ecosystem.trees.length,
        deer: ecosystem.deer.length
      })
    }

    // Sample clusters
    if (tick % CLUSTER_INTERVAL === 0 && tick > 0) {
      const treeClusters = kMeansSimple(
        ecosystem.trees.map(t => ({
          c1: t.characteristics.growthRate,
          c2: t.characteristics.reproductionRate,
          c3: t.characteristics.resilience
        })),
        3
      )

      const deerClusters = kMeansSimple(
        ecosystem.deer.map(d => ({
          c1: d.characteristics.speed,
          c2: d.characteristics.appetite,
          c3: d.characteristics.reach
        })),
        3
      )

      clusterHistory.push({
        tick,
        treeClusters: treeClusters.map(c => ({
          count: c.count,
          avgGrowth: c.avg1,
          avgRepro: c.avg2,
          avgResilience: c.avg3
        })),
        deerClusters: deerClusters.map(c => ({
          count: c.count,
          avgSpeed: c.avg1,
          avgAppetite: c.avg2,
          avgReach: c.avg3
        }))
      })
    }
  }

  if (survived) {
    finalTick = TICKS
  }

  // Compute statistics
  const treePops = populationHistory.map(p => p.trees)
  const deerPops = populationHistory.map(p => p.deer)

  const treeMean = treePops.reduce((a, b) => a + b, 0) / treePops.length
  const deerMean = deerPops.reduce((a, b) => a + b, 0) / deerPops.length

  const treeVariance = treePops.reduce((sum, val) => sum + (val - treeMean) ** 2, 0) / treePops.length
  const deerVariance = deerPops.reduce((sum, val) => sum + (val - deerMean) ** 2, 0) / deerPops.length

  // Count extinction events (population drops to < 5)
  let treeExtinctions = 0
  let deerExtinctions = 0
  for (let i = 1; i < populationHistory.length; i++) {
    if (populationHistory[i - 1].trees >= 5 && populationHistory[i].trees < 5) treeExtinctions++
    if (populationHistory[i - 1].deer >= 5 && populationHistory[i].deer < 5) deerExtinctions++
  }

  // Detect oscillations
  const treeOscillations = detectCycles(treePops)
  const deerOscillations = detectCycles(deerPops)

  // Compute cluster stability (coefficient of variation of cluster centroids over time)
  let treeClusterStability = 0
  let deerClusterStability = 0
  let avgTreeClusters = 0
  let avgDeerClusters = 0

  if (clusterHistory.length > 1) {
    // Track centroid positions over time and measure variance
    // Simplified: just count average number of clusters
    avgTreeClusters = clusterHistory.reduce((sum, c) => sum + c.treeClusters.length, 0) / clusterHistory.length
    avgDeerClusters = clusterHistory.reduce((sum, c) => sum + c.deerClusters.length, 0) / clusterHistory.length

    // Stability = 1 - (variance in cluster count / mean cluster count)
    const treeClusterCounts = clusterHistory.map(c => c.treeClusters.length)
    const deerClusterCounts = clusterHistory.map(c => c.deerClusters.length)

    const treeCountVariance = treeClusterCounts.reduce((sum, val) => sum + (val - avgTreeClusters) ** 2, 0) / treeClusterCounts.length
    const deerCountVariance = deerClusterCounts.reduce((sum, val) => sum + (val - avgDeerClusters) ** 2, 0) / deerClusterCounts.length

    treeClusterStability = Math.max(0, 1 - Math.sqrt(treeCountVariance) / avgTreeClusters)
    deerClusterStability = Math.max(0, 1 - Math.sqrt(deerCountVariance) / avgDeerClusters)
  }

  return {
    parameters: params,
    survived,
    finalTick,
    treeStats: {
      mean: treeMean,
      min: Math.min(...treePops),
      max: Math.max(...treePops),
      stdDev: Math.sqrt(treeVariance),
      extinctionEvents: treeExtinctions
    },
    deerStats: {
      mean: deerMean,
      min: Math.min(...deerPops),
      max: Math.max(...deerPops),
      stdDev: Math.sqrt(deerVariance),
      extinctionEvents: deerExtinctions
    },
    oscillations: {
      treeCycles: treeOscillations.count,
      deerCycles: deerOscillations.count,
      avgTreePeriod: treeOscillations.avgPeriod,
      avgDeerPeriod: deerOscillations.avgPeriod,
      treeAmplitude: treeOscillations.amplitude,
      deerAmplitude: deerOscillations.amplitude
    },
    diversity: {
      treeClusterStability,
      deerClusterStability,
      avgTreeClusters,
      avgDeerClusters
    },
    populationHistory,
    clusterHistory
  }
}

// Calculate stability score for ranking results
function calculateStabilityScore(result: SimulationResult): number {
  let score = 0

  // Survived to end: +100 points
  if (result.survived) {
    score += 100
  } else {
    // Partial credit for surviving longer
    score += (result.finalTick / TICKS) * 50
  }

  // Oscillations: +10 points per cycle (up to 50 points)
  const totalCycles = result.oscillations.treeCycles + result.oscillations.deerCycles
  score += Math.min(50, totalCycles * 10)

  // Good coefficient of variation (0.3-0.7 is ideal): up to 30 points
  const treeCOV = result.treeStats.stdDev / result.treeStats.mean
  const deerCOV = result.deerStats.stdDev / result.deerStats.mean

  if (treeCOV >= 0.3 && treeCOV <= 0.7) score += 15
  if (deerCOV >= 0.4 && deerCOV <= 0.8) score += 15

  // No extinction events: +20 points
  if (result.treeStats.extinctionEvents === 0) score += 10
  if (result.deerStats.extinctionEvents === 0) score += 10

  // Good cluster stability: up to 20 points
  score += result.diversity.treeClusterStability * 10
  score += result.diversity.deerClusterStability * 10

  // Multiple clusters maintained: up to 10 points
  if (result.diversity.avgTreeClusters >= 2.5) score += 5
  if (result.diversity.avgDeerClusters >= 2.5) score += 5

  return score
}

// Main sweep function
async function runParameterSweep() {
  console.log('🔬 Starting Parameter Sweep')
  console.log('==========================\n')

  // Generate all parameter combinations
  const combinations: any[] = []
  for (const baseSpreadChance of PARAMETER_SPACE.baseSpreadChance) {
    for (const baseCrowdedDeathChance of PARAMETER_SPACE.baseCrowdedDeathChance) {
      for (const deerReproduceChance of PARAMETER_SPACE.deerReproduceChance) {
        for (const deerStarvationPenalty of PARAMETER_SPACE.deerStarvationPenalty) {
          for (const deerReproduceAge of PARAMETER_SPACE.deerReproduceAge) {
            combinations.push({
              baseSpreadChance,
              baseCrowdedDeathChance,
              deerReproduceChance,
              deerStarvationPenalty,
              deerReproduceAge
            })
          }
        }
      }
    }
  }

  console.log(`Total combinations to test: ${combinations.length}`)
  console.log(`Ticks per simulation: ${TICKS}`)
  console.log(`Estimated time: ~${Math.ceil(combinations.length * 2 / 60)} minutes\n`)

  const results: SimulationResult[] = []
  const startTime = Date.now()

  for (let i = 0; i < combinations.length; i++) {
    const params = combinations[i]
    const simStart = Date.now()

    console.log(`[${i + 1}/${combinations.length}] Running simulation...`)
    console.log(`  Parameters: spread=${params.baseSpreadChance}, crowdDeath=${params.baseCrowdedDeathChance}, deerRepro=${params.deerReproduceChance}`)

    const result = runSimulation(params)
    results.push(result)

    const simTime = ((Date.now() - simStart) / 1000).toFixed(1)
    const status = result.survived ? '✅ SURVIVED' : `❌ DIED at tick ${result.finalTick}`
    const score = calculateStabilityScore(result).toFixed(1)

    console.log(`  ${status} | Score: ${score} | Time: ${simTime}s`)
    console.log(`  Trees: ${result.treeStats.mean.toFixed(0)} ± ${result.treeStats.stdDev.toFixed(0)} | Deer: ${result.deerStats.mean.toFixed(0)} ± ${result.deerStats.stdDev.toFixed(0)}`)
    console.log(`  Oscillations: ${result.oscillations.treeCycles} tree cycles, ${result.oscillations.deerCycles} deer cycles\n`)
  }

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
  console.log(`\n✅ Sweep Complete! Total time: ${totalTime} minutes\n`)

  // Sort results by stability score
  results.sort((a, b) => calculateStabilityScore(b) - calculateStabilityScore(a))

  // Write summary report
  const summaryReport = generateSummaryReport(results)
  fs.writeFileSync('sweep-results-summary.txt', summaryReport)
  console.log('📄 Summary report written to: sweep-results-summary.txt')

  // Write detailed results as JSON
  fs.writeFileSync('sweep-results-detailed.json', JSON.stringify(results, null, 2))
  console.log('📄 Detailed results written to: sweep-results-detailed.json')

  // Write CSV for easy analysis
  const csv = generateCSV(results)
  fs.writeFileSync('sweep-results.csv', csv)
  console.log('📄 CSV data written to: sweep-results.csv')

  console.log('\n🎯 Top 5 Best Configurations:')
  for (let i = 0; i < Math.min(5, results.length); i++) {
    const r = results[i]
    const score = calculateStabilityScore(r)
    console.log(`\n${i + 1}. Score: ${score.toFixed(1)}`)
    console.log(`   Parameters: ${JSON.stringify(r.parameters, null, 2)}`)
    console.log(`   Survived: ${r.survived}, Trees: ${r.treeStats.mean.toFixed(0)}, Deer: ${r.deerStats.mean.toFixed(0)}`)
    console.log(`   Oscillations: ${r.oscillations.treeCycles} tree, ${r.oscillations.deerCycles} deer`)
  }
}

function generateSummaryReport(results: SimulationResult[]): string {
  let report = 'PARAMETER SWEEP SUMMARY REPORT\n'
  report += '==============================\n\n'
  report += `Total Simulations: ${results.length}\n`
  report += `Ticks per Simulation: ${TICKS}\n\n`

  const survived = results.filter(r => r.survived).length
  report += `Survival Rate: ${survived}/${results.length} (${(100 * survived / results.length).toFixed(1)}%)\n\n`

  report += 'TOP 10 CONFIGURATIONS BY STABILITY SCORE:\n'
  report += '=========================================\n\n'

  for (let i = 0; i < Math.min(10, results.length); i++) {
    const r = results[i]
    const score = calculateStabilityScore(r)

    report += `${i + 1}. Score: ${score.toFixed(1)} | Survived: ${r.survived}\n`
    report += `   Parameters:\n`
    report += `     BASE_SPREAD_CHANCE: ${r.parameters.baseSpreadChance}\n`
    report += `     BASE_CROWDED_DEATH_CHANCE: ${r.parameters.baseCrowdedDeathChance}\n`
    report += `     DEER_REPRODUCE_CHANCE: ${r.parameters.deerReproduceChance}\n`
    report += `     DEER_STARVATION_PENALTY: ${r.parameters.deerStarvationPenalty}\n`
    report += `     DEER_REPRODUCE_AGE: ${r.parameters.deerReproduceAge}\n`
    report += `   Population:\n`
    report += `     Trees: ${r.treeStats.mean.toFixed(0)} ± ${r.treeStats.stdDev.toFixed(0)} (${r.treeStats.min}-${r.treeStats.max})\n`
    report += `     Deer: ${r.deerStats.mean.toFixed(0)} ± ${r.deerStats.stdDev.toFixed(0)} (${r.deerStats.min}-${r.deerStats.max})\n`
    report += `   Oscillations:\n`
    report += `     Tree Cycles: ${r.oscillations.treeCycles} (period: ${r.oscillations.avgTreePeriod.toFixed(0)} ticks)\n`
    report += `     Deer Cycles: ${r.oscillations.deerCycles} (period: ${r.oscillations.avgDeerPeriod.toFixed(0)} ticks)\n`
    report += `   Diversity:\n`
    report += `     Tree Clusters: ${r.diversity.avgTreeClusters.toFixed(1)} (stability: ${(r.diversity.treeClusterStability * 100).toFixed(0)}%)\n`
    report += `     Deer Clusters: ${r.diversity.avgDeerClusters.toFixed(1)} (stability: ${(r.diversity.deerClusterStability * 100).toFixed(0)}%)\n`
    report += `   Extinction Events: Trees ${r.treeStats.extinctionEvents}, Deer ${r.deerStats.extinctionEvents}\n\n`
  }

  return report
}

function generateCSV(results: SimulationResult[]): string {
  let csv = 'score,survived,finalTick,'
  csv += 'spread,crowdDeath,deerRepro,deerStarvation,deerReproAge,'
  csv += 'treeMean,treeStdDev,treeMin,treeMax,treeExtinctions,'
  csv += 'deerMean,deerStdDev,deerMin,deerMax,deerExtinctions,'
  csv += 'treeCycles,deerCycles,treePeriod,deerPeriod,treeAmp,deerAmp,'
  csv += 'treeClusterStability,deerClusterStability,avgTreeClusters,avgDeerClusters\n'

  for (const r of results) {
    const score = calculateStabilityScore(r)
    csv += `${score},${r.survived},${r.finalTick},`
    csv += `${r.parameters.baseSpreadChance},${r.parameters.baseCrowdedDeathChance},${r.parameters.deerReproduceChance},${r.parameters.deerStarvationPenalty},${r.parameters.deerReproduceAge},`
    csv += `${r.treeStats.mean.toFixed(1)},${r.treeStats.stdDev.toFixed(1)},${r.treeStats.min},${r.treeStats.max},${r.treeStats.extinctionEvents},`
    csv += `${r.deerStats.mean.toFixed(1)},${r.deerStats.stdDev.toFixed(1)},${r.deerStats.min},${r.deerStats.max},${r.deerStats.extinctionEvents},`
    csv += `${r.oscillations.treeCycles},${r.oscillations.deerCycles},${r.oscillations.avgTreePeriod.toFixed(0)},${r.oscillations.avgDeerPeriod.toFixed(0)},${r.oscillations.treeAmplitude.toFixed(1)},${r.oscillations.deerAmplitude.toFixed(1)},`
    csv += `${r.diversity.treeClusterStability.toFixed(3)},${r.diversity.deerClusterStability.toFixed(3)},${r.diversity.avgTreeClusters.toFixed(2)},${r.diversity.avgDeerClusters.toFixed(2)}\n`
  }

  return csv
}

// Run the sweep
runParameterSweep().catch(console.error)

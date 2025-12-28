import { initializeEcosystem, updateEcosystem, type Ecosystem } from './src/model/model'

function runSimulation(ticks: number, silent: boolean = false): {
  history: Array<{ tick: number, trees: number, deer: number, wolves: number }>,
  final: { trees: number, deer: number, wolves: number }
} {
  const ecosystem = initializeEcosystem()
  const history: Array<{ tick: number, trees: number, deer: number, wolves: number }> = []

  // Record initial state
  history.push({
    tick: 0,
    trees: ecosystem.trees.length,
    deer: ecosystem.deer.length,
    wolves: ecosystem.wolves.length
  })

  // Run simulation
  for (let tick = 1; tick <= ticks; tick++) {
    updateEcosystem(ecosystem)

    const counts = {
      tick,
      trees: ecosystem.trees.length,
      deer: ecosystem.deer.length,
      wolves: ecosystem.wolves.length
    }

    history.push(counts)

    // Print every 100 ticks if not silent
    if (!silent && tick % 100 === 0) {
      console.log(`Tick ${tick}: Trees=${counts.trees}, Deer=${counts.deer}, Wolves=${counts.wolves}`)
    }
  }

  const final = history[history.length - 1]
  return { history, final: { trees: final.trees, deer: final.deer, wolves: final.wolves } }
}

function analyzeResults(history: Array<{ tick: number, trees: number, deer: number, wolves: number }>) {
  const final = history[history.length - 1]

  // Check for extinctions
  const extinctions = []
  if (final.trees === 0) extinctions.push('trees')
  if (final.deer === 0) extinctions.push('deer')
  if (final.wolves === 0) extinctions.push('wolves')

  // Calculate average populations in second half (steady state)
  const secondHalf = history.slice(Math.floor(history.length / 2))
  const avgTrees = secondHalf.reduce((sum, h) => sum + h.trees, 0) / secondHalf.length
  const avgDeer = secondHalf.reduce((sum, h) => sum + h.deer, 0) / secondHalf.length
  const avgWolves = secondHalf.reduce((sum, h) => sum + h.wolves, 0) / secondHalf.length

  // Calculate variance (measure of dynamics)
  const treesVar = secondHalf.reduce((sum, h) => sum + Math.pow(h.trees - avgTrees, 2), 0) / secondHalf.length
  const deerVar = secondHalf.reduce((sum, h) => sum + Math.pow(h.deer - avgDeer, 2), 0) / secondHalf.length
  const wolvesVar = secondHalf.reduce((sum, h) => sum + Math.pow(h.wolves - avgWolves, 2), 0) / secondHalf.length

  return {
    final,
    extinctions,
    averages: { trees: avgTrees, deer: avgDeer, wolves: avgWolves },
    variance: { trees: treesVar, deer: deerVar, wolves: wolvesVar },
    stdDev: { trees: Math.sqrt(treesVar), deer: Math.sqrt(deerVar), wolves: Math.sqrt(wolvesVar) }
  }
}

// Main execution
const NUM_RUNS = 5
const TICKS = 1000

console.log(`Running ${NUM_RUNS} simulations of ${TICKS} ticks each...\n`)

const results = []
for (let run = 0; run < NUM_RUNS; run++) {
  console.log(`\n=== Run ${run + 1}/${NUM_RUNS} ===`)
  const { history, final } = runSimulation(TICKS)
  const analysis = analyzeResults(history)
  results.push(analysis)

  console.log(`\nFinal populations: Trees=${final.trees}, Deer=${final.deer}, Wolves=${final.wolves}`)
  if (analysis.extinctions.length > 0) {
    console.log(`⚠️  EXTINCTIONS: ${analysis.extinctions.join(', ')}`)
  }
  console.log(`Average (2nd half): Trees=${analysis.averages.trees.toFixed(1)}, Deer=${analysis.averages.deer.toFixed(1)}, Wolves=${analysis.averages.wolves.toFixed(1)}`)
  console.log(`Std Dev (dynamics): Trees=${analysis.stdDev.trees.toFixed(1)}, Deer=${analysis.stdDev.deer.toFixed(1)}, Wolves=${analysis.stdDev.wolves.toFixed(1)}`)
}

// Summary
console.log('\n\n=== SUMMARY ===')
const deerExtinct = results.filter(r => r.extinctions.includes('deer')).length
const wolfExtinct = results.filter(r => r.extinctions.includes('wolves')).length
const treeExtinct = results.filter(r => r.extinctions.includes('trees')).length

console.log(`Deer extinctions: ${deerExtinct}/${NUM_RUNS}`)
console.log(`Wolf extinctions: ${wolfExtinct}/${NUM_RUNS}`)
console.log(`Tree extinctions: ${treeExtinct}/${NUM_RUNS}`)

const avgFinalDeer = results.reduce((sum, r) => sum + r.final.deer, 0) / NUM_RUNS
const avgFinalWolves = results.reduce((sum, r) => sum + r.final.wolves, 0) / NUM_RUNS
const avgFinalTrees = results.reduce((sum, r) => sum + r.final.trees, 0) / NUM_RUNS

console.log(`\nAverage final populations:`)
console.log(`  Trees: ${avgFinalTrees.toFixed(1)}`)
console.log(`  Deer: ${avgFinalDeer.toFixed(1)}`)
console.log(`  Wolves: ${avgFinalWolves.toFixed(1)}`)

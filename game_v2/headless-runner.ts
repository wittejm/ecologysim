import { initializeEcosystem, updateEcosystem, type Ecosystem } from './src/model/model'
import { writeFileSync, appendFileSync } from 'fs'

interface SimulationStats {
  tick: number
  treeCount: number
  deerCount: number
  wolfCount: number
  avgGrowthRate: number
  avgReproductionRate: number
  avgResilience: number
  minGrowthRate: number
  maxGrowthRate: number
  minReproductionRate: number
  maxReproductionRate: number
  minResilience: number
  maxResilience: number
}

function collectStats(ecosystem: Ecosystem, tick: number): SimulationStats {
  const trees = ecosystem.trees
  const count = trees.length

  if (count === 0) {
    return {
      tick,
      treeCount: 0,
      deerCount: ecosystem.deer.length,
      wolfCount: ecosystem.wolves.length,
      avgGrowthRate: 0,
      avgReproductionRate: 0,
      avgResilience: 0,
      minGrowthRate: 0,
      maxGrowthRate: 0,
      minReproductionRate: 0,
      maxReproductionRate: 0,
      minResilience: 0,
      maxResilience: 0
    }
  }

  const totals = trees.reduce(
    (acc, tree) => ({
      optimalMoisture: acc.optimalMoisture + tree.characteristics.optimalMoisture,
      reproductionRate: acc.reproductionRate + tree.characteristics.reproductionRate,
      resilience: acc.resilience + tree.characteristics.resilience
    }),
    { optimalMoisture: 0, reproductionRate: 0, resilience: 0 }
  )

  const optimalMoistures = trees.map(t => t.characteristics.optimalMoisture)
  const reproductionRates = trees.map(t => t.characteristics.reproductionRate)
  const resiliences = trees.map(t => t.characteristics.resilience)

  return {
    tick,
    treeCount: count,
    deerCount: ecosystem.deer.length,
    wolfCount: ecosystem.wolves.length,
    avgGrowthRate: totals.optimalMoisture / count,
    avgReproductionRate: totals.reproductionRate / count,
    avgResilience: totals.resilience / count,
    minGrowthRate: Math.min(...optimalMoistures),
    maxGrowthRate: Math.max(...optimalMoistures),
    minReproductionRate: Math.min(...reproductionRates),
    maxReproductionRate: Math.max(...reproductionRates),
    minResilience: Math.min(...resiliences),
    maxResilience: Math.max(...resiliences)
  }
}

function runSimulation(ticks: number, reportInterval: number = 100): SimulationStats[] {
  console.log(`\n🌲 Starting headless simulation for ${ticks} ticks...\n`)

  const ecosystem = initializeEcosystem()
  const stats: SimulationStats[] = []

  // Initial stats
  stats.push(collectStats(ecosystem, 0))

  for (let tick = 1; tick <= ticks; tick++) {
    updateEcosystem(ecosystem)

    if (tick % reportInterval === 0 || tick === ticks) {
      const stat = collectStats(ecosystem, tick)
      stats.push(stat)

      console.log(`Tick ${tick.toString().padStart(5)}: Trees: ${stat.treeCount.toString().padStart(4)} | Deer: ${stat.deerCount.toString().padStart(3)} | Wolves: ${stat.wolfCount.toString().padStart(2)} | ` +
        `OptM:${stat.avgGrowthRate.toFixed(2)} Repr:${stat.avgReproductionRate.toFixed(2)} Res:${stat.avgResilience.toFixed(2)}`)

      // Check for extinction
      if (stat.treeCount === 0 && stat.deerCount === 0 && stat.wolfCount === 0) {
        console.log(`\n💀 TOTAL ECOSYSTEM COLLAPSE at tick ${tick}!\n`)
        break
      } else if (stat.treeCount === 0) {
        console.log(`\n🌳 All trees gone at tick ${tick} (deer: ${stat.deerCount}, wolves: ${stat.wolfCount})\n`)
      } else if (stat.deerCount === 0 && stat.wolfCount > 0) {
        console.log(`\n🦌 Deer extinct at tick ${tick} - wolves will starve!\n`)
      } else if (stat.wolfCount === 0 && stat.deerCount > 0) {
        console.log(`\n🐺 Wolves extinct at tick ${tick} - deer population released!\n`)
      }
    }
  }

  return stats
}

function log(message: string) {
  console.log(message)
  appendFileSync('testing_log.txt', message + '\n')
}

function analyzeResults(stats: SimulationStats[]) {
  const timestamp = new Date().toISOString()
  log('\n' + '='.repeat(60))
  log(`📊 SIMULATION ANALYSIS - ${timestamp}`)
  log('='.repeat(60))

  const final = stats[stats.length - 1]
  const initial = stats[0]

  log(`\n🌱 Initial Population: ${initial.treeCount}`)
  log(`🌳 Final Population: ${final.treeCount}`)
  log(`📈 Change: ${((final.treeCount - initial.treeCount) / initial.treeCount * 100).toFixed(1)}%`)

  const maxPop = Math.max(...stats.map(s => s.treeCount))
  const minPop = Math.min(...stats.filter(s => s.treeCount > 0).map(s => s.treeCount))
  log(`📊 Population Range: ${minPop} - ${maxPop} trees`)

  log(`\n🧬 Final Average Characteristics:`)
  log(`   Growth Rate: ${final.avgGrowthRate.toFixed(3)} (range: ${final.minGrowthRate.toFixed(2)}-${final.maxGrowthRate.toFixed(2)})`)
  log(`   Reproduction: ${final.avgReproductionRate.toFixed(3)} (range: ${final.minReproductionRate.toFixed(2)}-${final.maxReproductionRate.toFixed(2)})`)
  log(`   Resilience: ${final.avgResilience.toFixed(3)} (range: ${final.minResilience.toFixed(2)}-${final.maxResilience.toFixed(2)})`)

  log(`\n🔄 Evolution from start:`)
  log(`   Growth Rate: ${initial.avgGrowthRate.toFixed(3)} → ${final.avgGrowthRate.toFixed(3)} (${(final.avgGrowthRate - initial.avgGrowthRate > 0 ? '+' : '')}${(final.avgGrowthRate - initial.avgGrowthRate).toFixed(3)})`)
  log(`   Reproduction: ${initial.avgReproductionRate.toFixed(3)} → ${final.avgReproductionRate.toFixed(3)} (${(final.avgReproductionRate - initial.avgReproductionRate > 0 ? '+' : '')}${(final.avgReproductionRate - initial.avgReproductionRate).toFixed(3)})`)
  log(`   Resilience: ${initial.avgResilience.toFixed(3)} → ${final.avgResilience.toFixed(3)} (${(final.avgResilience - initial.avgResilience > 0 ? '+' : '')}${(final.avgResilience - initial.avgResilience).toFixed(3)})`)

  // Check if population stabilized
  const lastQuarter = stats.slice(Math.floor(stats.length * 0.75))
  const avgPopLastQuarter = lastQuarter.reduce((sum, s) => sum + s.treeCount, 0) / lastQuarter.length
  const stdDev = Math.sqrt(lastQuarter.reduce((sum, s) => sum + Math.pow(s.treeCount - avgPopLastQuarter, 2), 0) / lastQuarter.length)
  const stabilized = stdDev / avgPopLastQuarter < 0.1

  log(`\n⚖️  Population Stability: ${stabilized ? '✅ STABLE' : '❌ UNSTABLE'}`)
  log(`   Last quarter average: ${avgPopLastQuarter.toFixed(0)} ± ${stdDev.toFixed(0)} trees`)

  log('\n' + '='.repeat(60) + '\n')
}

// Run the simulation
const TICKS = 3000  // Test for robust predator-prey cycles over long period
const REPORT_INTERVAL = 150

const stats = runSimulation(TICKS, REPORT_INTERVAL)
analyzeResults(stats)

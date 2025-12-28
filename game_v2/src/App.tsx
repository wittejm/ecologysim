import { useEffect, useRef, useState } from 'react'
import * as PIXI from 'pixi.js'
import { initializeEcosystem, updateEcosystem, getTreeColor, getDeerColor, getWolfColor, getMaxSize, getSpreadDistance, GRID_SIZE, type Ecosystem, type Tree, type Deer, type Wolf } from './model/model'
import { GPUCrowdednessCalculator } from './gpu-crowdedness'
import './App.css'

interface Cluster {
  count: number
  avg1: number
  avg2: number
  avg3: number
  std1: number
  std2: number
  std3: number
}

// Generic K-means clustering for up to 3 clusters
function kMeansClusteringGeneric(
  items: { char1: number; char2: number; char3: number }[],
  k: number = 3
): Cluster[] {
  if (items.length === 0) return []

  // Use actual k = min(k, item count)
  const actualK = Math.min(k, items.length)

  // Initialize centroids randomly from items
  const centroids: number[][] = []
  const usedIndices = new Set<number>()
  while (centroids.length < actualK) {
    const idx = Math.floor(Math.random() * items.length)
    if (!usedIndices.has(idx)) {
      usedIndices.add(idx)
      const item = items[idx]
      centroids.push([item.char1, item.char2, item.char3])
    }
  }

  // Run k-means iterations (max 10)
  const assignments: number[] = new Array(items.length)
  for (let iter = 0; iter < 10; iter++) {
    // Assign each item to nearest centroid
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const point = [item.char1, item.char2, item.char3]
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
          clusterItems.reduce((sum, item) => sum + item.char1, 0) / clusterItems.length,
          clusterItems.reduce((sum, item) => sum + item.char2, 0) / clusterItems.length,
          clusterItems.reduce((sum, item) => sum + item.char3, 0) / clusterItems.length
        ]
      }
    }
  }

  // Calculate cluster statistics
  const clusters: Cluster[] = []
  for (let j = 0; j < actualK; j++) {
    const clusterItems = items.filter((_, i) => assignments[i] === j)
    if (clusterItems.length === 0) continue

    const avg1 = clusterItems.reduce((sum, item) => sum + item.char1, 0) / clusterItems.length
    const avg2 = clusterItems.reduce((sum, item) => sum + item.char2, 0) / clusterItems.length
    const avg3 = clusterItems.reduce((sum, item) => sum + item.char3, 0) / clusterItems.length

    const std1 = Math.sqrt(clusterItems.reduce((sum, item) => sum + (item.char1 - avg1) ** 2, 0) / clusterItems.length)
    const std2 = Math.sqrt(clusterItems.reduce((sum, item) => sum + (item.char2 - avg2) ** 2, 0) / clusterItems.length)
    const std3 = Math.sqrt(clusterItems.reduce((sum, item) => sum + (item.char3 - avg3) ** 2, 0) / clusterItems.length)

    clusters.push({
      count: clusterItems.length,
      avg1,
      avg2,
      avg3,
      std1,
      std2,
      std3
    })
  }

  // Sort clusters by count (largest first)
  clusters.sort((a, b) => b.count - a.count)

  return clusters
}

function App() {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [treeCount, setTreeCount] = useState(0)
  const [deerCount, setDeerCount] = useState(0)
  const [wolfCount, setWolfCount] = useState(0)
  const [avgCharacteristics, setAvgCharacteristics] = useState({
    optimalMoisture: 0,
    resilience: 0,
    reproductionRate: 0
  })
  const [selectedTree, setSelectedTree] = useState<Tree | null>(null)
  const [computeTime, setComputeTime] = useState(0)
  const [profiling, setProfiling] = useState({
    crowdednessGPU: 0,
    crowdednessCPU: 0,
    ecosystemUpdate: 0,
    kMeans: 0,
    render: 0,
    total: 0,
    usedGPU: false,
    renderFPS: 0
  })
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [deerClusters, setDeerClusters] = useState<Cluster[]>([])
  const [wolfClusters, setWolfClusters] = useState<Cluster[]>([])
  const [populationHistory, setPopulationHistory] = useState<Array<{tick: number, trees: number, deer: number, wolves: number}>>([])
  const pixiAppRef = useRef<PIXI.Application | null>(null)
  const ecosystemRef = useRef<Ecosystem | null>(null)
  const lastTreeCountRef = useRef(0)
  const treeGraphicsRef = useRef<PIXI.Graphics | null>(null)
  const deerGraphicsRef = useRef<PIXI.Graphics | null>(null)
  const wolfGraphicsRef = useRef<PIXI.Graphics | null>(null)
  const tickCounterRef = useRef(0)
  const totalTicksRef = useRef(0)
  const gpuCalculatorRef = useRef<GPUCrowdednessCalculator | null>(null)
  const lastRenderTimeRef = useRef(0)
  const lastRenderAttemptRef = useRef(0)
  const renderTimesRef = useRef<number[]>([])
  const skippedFramesRef = useRef(0)

  // Initialize GPU calculator
  useEffect(() => {
    const gpuCalc = new GPUCrowdednessCalculator()
    if (gpuCalc.init()) {
      gpuCalculatorRef.current = gpuCalc
    }

    return () => {
      if (gpuCalculatorRef.current) {
        gpuCalculatorRef.current.destroy()
      }
    }
  }, [])

  useEffect(() => {
    if (!canvasRef.current) return

    const initPixi = async () => {
      const app = new PIXI.Application()

      const buttonHeight = 70
      const canvasWidth = window.innerWidth
      const canvasHeight = window.innerHeight - buttonHeight

      await app.init({
        width: canvasWidth,
        height: canvasHeight,
        backgroundColor: 0xeeeeee,
        antialias: true,
      })

      if (!canvasRef.current) return

      canvasRef.current.appendChild(app.canvas)
      pixiAppRef.current = app

      const ecosystem = initializeEcosystem()
      ecosystemRef.current = ecosystem

      // Initialize population history
      setPopulationHistory([{
        tick: 0,
        trees: ecosystem.trees.length,
        deer: ecosystem.deer.length,
        wolves: ecosystem.wolves.length
      }])

      renderTrees(app, ecosystem)
      updateStatistics(ecosystem)
    }

    initPixi()

    return () => {
      if (pixiAppRef.current) {
        pixiAppRef.current.destroy(true, { children: true })
      }
    }
  }, [])

  useEffect(() => {
    if (!isRunning || !ecosystemRef.current) return

    const interval = setInterval(() => {
      if (ecosystemRef.current) {
        const overallStart = performance.now()
        let gpuTime = 0, cpuTime = 0, ecosystemTime = 0, kMeansTime = 0
        let usedGPU = false

        // Try GPU acceleration for crowdedness calculation (threshold: 500 trees)
        let gpuCrowdedness: number[] | null | undefined = null
        const numTrees = ecosystemRef.current.trees.length

        if (gpuCalculatorRef.current && numTrees >= 500) {
          const gpuStart = performance.now()
          const ecosystem = ecosystemRef.current
          gpuCrowdedness = gpuCalculatorRef.current.calculate(
            ecosystem.trees,
            (tree) => getMaxSize(tree, ecosystem),
            getSpreadDistance
          )
          gpuTime = performance.now() - gpuStart
          if (gpuCrowdedness) usedGPU = true
        }

        // Update ecosystem (with optional GPU-computed crowdedness)
        const ecosystemStart = performance.now()
        updateEcosystem(ecosystemRef.current, gpuCrowdedness || undefined)
        ecosystemTime = performance.now() - ecosystemStart

        // If we didn't use GPU, the ecosystem update includes CPU crowdedness calculation
        if (!usedGPU) {
          cpuTime = ecosystemTime  // Approximate - CPU crowdedness is embedded in update
        }

        updateStatistics(ecosystemRef.current)

        // Track total ticks
        totalTicksRef.current++

        // Record population every 10 ticks
        if (totalTicksRef.current % 10 === 0) {
          setPopulationHistory(prev => {
            const newHistory = [...prev, {
              tick: totalTicksRef.current,
              trees: ecosystemRef.current!.trees.length,
              deer: ecosystemRef.current!.deer.length,
              wolves: ecosystemRef.current!.wolves.length
            }]
            // Keep only last 100 datapoints
            return newHistory.slice(-100)
          })
        }

        // Update clusters every `speed` ticks (once per second)
        tickCounterRef.current++
        if (tickCounterRef.current >= speed) {
          tickCounterRef.current = 0

          const kMeansStart = performance.now()
          const newClusters = kMeansClusteringGeneric(
            ecosystemRef.current.trees.map(t => ({
              char1: t.characteristics.optimalMoisture,
              char2: t.characteristics.resilience,
              char3: t.characteristics.reproductionRate
            })),
            10
          )
          // Keep only top 3 clusters by size for display
          setClusters(newClusters.slice(0, 3))

          const newDeerClusters = kMeansClusteringGeneric(
            ecosystemRef.current.deer.map(d => ({
              char1: d.characteristics.vitality,
              char2: d.characteristics.speed,
              char3: d.characteristics.appetite
            })),
            10
          )
          // Keep only top 3 clusters by size for display
          setDeerClusters(newDeerClusters.slice(0, 3))

          const newWolfClusters = kMeansClusteringGeneric(
            ecosystemRef.current.wolves.map(w => ({
              char1: w.characteristics.vitality,
              char2: w.characteristics.speed,
              char3: w.characteristics.hunting
            })),
            10
          )
          // Keep only top 3 clusters by size for display
          setWolfClusters(newWolfClusters.slice(0, 3))
          kMeansTime = performance.now() - kMeansStart
        }

        const totalTime = performance.now() - overallStart

        setProfiling({
          crowdednessGPU: gpuTime,
          crowdednessCPU: cpuTime,
          ecosystemUpdate: ecosystemTime,
          kMeans: kMeansTime,
          render: lastRenderTimeRef.current,  // Use persisted render time from ref
          total: totalTime,
          usedGPU
        })

        setComputeTime(totalTime)
      }
    }, 1000 / speed)

    return () => clearInterval(interval)
  }, [isRunning, speed])

  useEffect(() => {
    if (!isRunning || !pixiAppRef.current || !ecosystemRef.current) return

    let animationFrameId: number

    const render = () => {
      if (pixiAppRef.current && ecosystemRef.current) {
        const now = performance.now()

        // Calculate adaptive render interval based on recent render performance
        const avgRenderTime = renderTimesRef.current.length > 0
          ? renderTimesRef.current.reduce((a, b) => a + b, 0) / renderTimesRef.current.length
          : 16  // Default assumption: 16ms

        // Add 70% buffer to average render time, with minimum interval of 16ms (60fps max)
        // This ensures we only render when we're confident we won't fall behind
        const minRenderInterval = Math.max(16, avgRenderTime * 1.7)
        const timeSinceLastRender = now - lastRenderAttemptRef.current

        // Only render if enough time has passed AND tree count changed
        const currentTreeCount = ecosystemRef.current.trees.length
        const treeCountChanged = currentTreeCount !== lastTreeCountRef.current

        if (timeSinceLastRender >= minRenderInterval && treeCountChanged) {
          // Attempt render
          lastRenderAttemptRef.current = now
          const renderStart = performance.now()
          renderTrees(pixiAppRef.current, ecosystemRef.current)
          const renderTime = performance.now() - renderStart
          lastTreeCountRef.current = currentTreeCount

          // Track render times (keep last 10 for rolling average)
          renderTimesRef.current.push(renderTime)
          if (renderTimesRef.current.length > 10) {
            renderTimesRef.current.shift()
          }

          // Calculate effective FPS based on adaptive interval
          const effectiveFPS = 1000 / minRenderInterval

          // Store render time in ref so it persists across updates
          lastRenderTimeRef.current = renderTime
          skippedFramesRef.current = 0  // Reset skip counter

          // Update profiling state with render FPS
          setProfiling(prev => ({ ...prev, renderFPS: effectiveFPS }))
        } else if (treeCountChanged) {
          skippedFramesRef.current++
        }
      }
      animationFrameId = requestAnimationFrame(render)
    }

    animationFrameId = requestAnimationFrame(render)

    return () => cancelAnimationFrame(animationFrameId)
  }, [isRunning])

  const increaseSpeed = () => {
    if (speed === 1) setSpeed(2)
    else if (speed === 2) setSpeed(5)
    else if (speed === 5) setSpeed(10)
    else if (speed === 10) setSpeed(20)
    else if (speed === 20) setSpeed(50)
  }

  const decreaseSpeed = () => {
    if (speed === 50) setSpeed(20)
    else if (speed === 20) setSpeed(10)
    else if (speed === 10) setSpeed(5)
    else if (speed === 5) setSpeed(2)
    else if (speed === 2) setSpeed(1)
  }

  const updateStatistics = (ecosystem: Ecosystem) => {
    setTreeCount(ecosystem.trees.length)
    setDeerCount(ecosystem.deer.length)
    setWolfCount(ecosystem.wolves.length)

    if (ecosystem.trees.length === 0) {
      setAvgCharacteristics({ optimalMoisture: 0, resilience: 0, reproductionRate: 0 })
      return
    }

    const totals = ecosystem.trees.reduce(
      (acc, tree) => ({
        optimalMoisture: acc.optimalMoisture + tree.characteristics.optimalMoisture,
        resilience: acc.resilience + tree.characteristics.resilience,
        reproductionRate: acc.reproductionRate + tree.characteristics.reproductionRate
      }),
      { optimalMoisture: 0, resilience: 0, reproductionRate: 0 }
    )

    setAvgCharacteristics({
      optimalMoisture: totals.optimalMoisture / ecosystem.trees.length,
      resilience: totals.resilience / ecosystem.trees.length,
      reproductionRate: totals.reproductionRate / ecosystem.trees.length
    })
  }

  const renderTrees = (app: PIXI.Application, ecosystem: Ecosystem) => {
    const width = app.screen.width
    const height = app.screen.height

    // Render terrain as background
    const cellWidth = width / GRID_SIZE
    const cellHeight = height / GRID_SIZE

    // Create terrain graphics if it doesn't exist
    if (!app.stage.children.find(child => child.label === 'terrain')) {
      const terrainGraphics = new PIXI.Graphics()
      terrainGraphics.label = 'terrain'
      app.stage.addChildAt(terrainGraphics, 0) // Add at bottom layer

      // Draw terrain grid
      for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE; y++) {
          const moisture = ecosystem.terrain[x][y]

          // Greenish-gray color based on moisture
          // Lower moisture (0) = darker (0x3a4a3a)
          // Higher moisture (1) = lighter (0xc5d5c5)
          const baseGreen = 0x3a + Math.floor(moisture * (0xc5 - 0x3a))
          const baseGray = 0x4a + Math.floor(moisture * (0xd5 - 0x4a))
          const color = (baseGreen << 16) | (baseGray << 8) | baseGreen

          terrainGraphics.rect(x * cellWidth, y * cellHeight, cellWidth, cellHeight)
          terrainGraphics.fill(color)
        }
      }
    }

    // Reuse Graphics objects instead of creating new ones each frame
    if (!treeGraphicsRef.current) {
      treeGraphicsRef.current = new PIXI.Graphics()
      app.stage.addChild(treeGraphicsRef.current)
    }

    if (!deerGraphicsRef.current) {
      deerGraphicsRef.current = new PIXI.Graphics()
      app.stage.addChild(deerGraphicsRef.current)
    }

    if (!wolfGraphicsRef.current) {
      wolfGraphicsRef.current = new PIXI.Graphics()
      app.stage.addChild(wolfGraphicsRef.current)
    }

    const treeGraphics = treeGraphicsRef.current
    const deerGraphics = deerGraphicsRef.current
    const wolfGraphics = wolfGraphicsRef.current

    // Clear and redraw trees
    treeGraphics.clear()
    ecosystem.trees.forEach(tree => {
      const radius = tree.size < 3 ? 2 : tree.size < 8 ? 3.5 : 5
      const x = tree.x * width
      const y = tree.y * height

      treeGraphics.circle(x, y, radius)
      treeGraphics.fill(getTreeColor(tree.characteristics))
    })

    // Clear and redraw deer
    deerGraphics.clear()
    const deerSize = 6

    ecosystem.deer.forEach(deer => {
      const x = deer.x * width
      const y = deer.y * height

      // Draw triangle pointing up
      deerGraphics.poly([
        x, y - deerSize,
        x - deerSize * 0.7, y + deerSize * 0.5,
        x + deerSize * 0.7, y + deerSize * 0.5
      ])
      deerGraphics.fill(getDeerColor(deer.characteristics))
    })

    // Clear and redraw wolves (as squares)
    wolfGraphics.clear()
    const wolfSize = 7

    ecosystem.wolves.forEach(wolf => {
      const x = wolf.x * width
      const y = wolf.y * height

      // Draw square
      wolfGraphics.rect(x - wolfSize / 2, y - wolfSize / 2, wolfSize, wolfSize)
      wolfGraphics.fill(getWolfColor(wolf.characteristics))
    })
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      margin: 0,
      padding: 0
    }}>
      <div ref={canvasRef} style={{
        width: '100%',
        height: 'calc(100vh - 70px)',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* Cluster Statistics Overlay */}
        {clusters.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '15px',
            borderRadius: '8px',
            fontFamily: 'monospace',
            fontSize: '12px',
            maxWidth: '300px',
            zIndex: 1000
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '10px', fontSize: '14px' }}>
              Tree Clusters
            </div>
            {clusters.map((cluster, idx) => {
              const clusterColor = getTreeColor({
                optimalMoisture: cluster.avg1,
                resilience: cluster.avg2,
                reproductionRate: cluster.avg3
              })
              const colorHex = `#${clusterColor.toString(16).padStart(6, '0')}`

              return (
                <div key={idx} style={{
                  marginBottom: '12px',
                  padding: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px'
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px', color: colorHex }}>
                    Cluster {idx + 1}: {cluster.count} trees ({((cluster.count / treeCount) * 100).toFixed(1)}%)
                  </div>
                  <div style={{ fontSize: '11px', lineHeight: '1.4' }}>
                    <div>OptM: {cluster.avg1.toFixed(2)} ± {cluster.std1.toFixed(2)}</div>
                    <div>Resi: {cluster.avg2.toFixed(2)} ± {cluster.std2.toFixed(2)}</div>
                    <div>Repr: {cluster.avg3.toFixed(2)} ± {cluster.std3.toFixed(2)}</div>
                  </div>
                </div>
              )
            })}

            {/* Deer Clusters */}
            {deerClusters.length > 0 && (
              <>
                <div style={{ fontWeight: 'bold', marginTop: '15px', marginBottom: '10px', fontSize: '14px', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '15px' }}>
                  Deer Clusters
                </div>
                {deerClusters.map((cluster, idx) => {
                  const clusterColor = getDeerColor({
                    vitality: cluster.avg1,
                    speed: cluster.avg2,
                    appetite: cluster.avg3
                  })
                  const colorHex = `#${clusterColor.toString(16).padStart(6, '0')}`

                  return (
                    <div key={idx} style={{
                      marginBottom: '12px',
                      padding: '8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '4px'
                    }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '4px', color: colorHex }}>
                        Cluster {idx + 1}: {cluster.count} deer ({((cluster.count / deerCount) * 100).toFixed(1)}%)
                      </div>
                      <div style={{ fontSize: '11px', lineHeight: '1.4' }}>
                        <div>Vit: {cluster.avg1.toFixed(2)} ± {cluster.std1.toFixed(2)}</div>
                        <div>Spd: {cluster.avg2.toFixed(2)} ± {cluster.std2.toFixed(2)}</div>
                        <div>App: {cluster.avg3.toFixed(2)} ± {cluster.std3.toFixed(2)}</div>
                      </div>
                    </div>
                  )
                })}
              </>
            )}

            {/* Wolf Clusters */}
            {wolfClusters.length > 0 && (
              <>
                <div style={{ fontWeight: 'bold', marginTop: '15px', marginBottom: '10px', fontSize: '14px', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '15px' }}>
                  Wolf Clusters
                </div>
                {wolfClusters.map((cluster, idx) => {
                  const clusterColor = getWolfColor({
                    vitality: cluster.avg1,
                    speed: cluster.avg2,
                    hunting: cluster.avg3
                  })
                  const colorHex = `#${clusterColor.toString(16).padStart(6, '0')}`

                  return (
                    <div key={idx} style={{
                      marginBottom: '12px',
                      padding: '8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '4px'
                    }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '4px', color: colorHex }}>
                        Cluster {idx + 1}: {cluster.count} wolves ({((cluster.count / wolfCount) * 100).toFixed(1)}%)
                      </div>
                      <div style={{ fontSize: '11px', lineHeight: '1.4' }}>
                        <div>Vit: {cluster.avg1.toFixed(2)} ± {cluster.std1.toFixed(2)}</div>
                        <div>Spd: {cluster.avg2.toFixed(2)} ± {cluster.std2.toFixed(2)}</div>
                        <div>Hunt: {cluster.avg3.toFixed(2)} ± {cluster.std3.toFixed(2)}</div>
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}

        {/* Population History Chart */}
        {populationHistory.length > 1 && (
          <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '15px',
            borderRadius: '8px',
            fontFamily: 'monospace',
            fontSize: '12px',
            zIndex: 1000
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '10px', fontSize: '14px' }}>
              Population History (last {populationHistory.length * 10} ticks)
            </div>
            <svg width="300" height="200" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px' }}>
              {/* Draw grid lines */}
              {[0, 1, 2, 3, 4].map(i => (
                <line
                  key={`grid-${i}`}
                  x1="0"
                  y1={i * 50}
                  x2="300"
                  y2={i * 50}
                  stroke="rgba(255, 255, 255, 0.1)"
                  strokeWidth="1"
                />
              ))}

              {/* Draw tree population line */}
              {(() => {
                const maxTrees = Math.max(...populationHistory.map(h => h.trees), 100) * 1.2
                const points = populationHistory.map((h, i) => {
                  const x = (i / (populationHistory.length - 1)) * 300
                  const y = 200 - (h.trees / maxTrees) * 200
                  return `${x},${y}`
                }).join(' ')

                return (
                  <polyline
                    points={points}
                    fill="none"
                    stroke="#22dd22"
                    strokeWidth="2"
                  />
                )
              })()}

              {/* Draw deer population line */}
              {(() => {
                const maxDeer = Math.max(...populationHistory.map(h => h.deer), 10) * 1.2
                const points = populationHistory.map((h, i) => {
                  const x = (i / (populationHistory.length - 1)) * 300
                  const y = 200 - (h.deer / maxDeer) * 200
                  return `${x},${y}`
                }).join(' ')

                return (
                  <polyline
                    points={points}
                    fill="none"
                    stroke="#dd8844"
                    strokeWidth="2"
                  />
                )
              })()}

              {/* Draw wolf population line */}
              {(() => {
                const maxWolves = Math.max(...populationHistory.map(h => h.wolves), 5) * 1.2
                const points = populationHistory.map((h, i) => {
                  const x = (i / (populationHistory.length - 1)) * 300
                  const y = 200 - (h.wolves / maxWolves) * 200
                  return `${x},${y}`
                }).join(' ')

                return (
                  <polyline
                    points={points}
                    fill="none"
                    stroke="#6688cc"
                    strokeWidth="2"
                  />
                )
              })()}
            </svg>
            <div style={{ marginTop: '8px', fontSize: '11px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '20px', height: '2px', backgroundColor: '#22dd22' }}></div>
                <span>Trees: {populationHistory[populationHistory.length - 1]?.trees || 0}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px' }}>
                <div style={{ width: '20px', height: '2px', backgroundColor: '#dd8844' }}></div>
                <span>Deer: {populationHistory[populationHistory.length - 1]?.deer || 0}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px' }}>
                <div style={{ width: '20px', height: '2px', backgroundColor: '#6688cc' }}></div>
                <span>Wolves: {populationHistory[populationHistory.length - 1]?.wolves || 0}</span>
              </div>
            </div>
          </div>
        )}
      </div>
      <div style={{
        height: '70px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '20px',
        backgroundColor: '#1a1a1a'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          fontSize: '12px',
          color: 'white',
          marginRight: '10px'
        }}>
          <div>Trees: {treeCount} | Deer: {deerCount} | Wolves: {wolfCount}</div>
          <div style={{ fontSize: '10px', color: '#aaa' }}>
            OptM:{avgCharacteristics.optimalMoisture.toFixed(2)}
            {' '}Resi:{avgCharacteristics.resilience.toFixed(2)}
            {' '}Repr:{avgCharacteristics.reproductionRate.toFixed(2)}
          </div>
        </div>

        {selectedTree && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            fontSize: '11px',
            color: '#ffee88',
            marginRight: '10px',
            backgroundColor: '#333',
            padding: '4px 8px',
            borderRadius: '4px'
          }}>
            <div>Tree #{selectedTree.id}</div>
            <div>Age: {selectedTree.age} | Size: {selectedTree.size.toFixed(1)}</div>
            <div>
              OptM:{selectedTree.characteristics.optimalMoisture.toFixed(2)}
              {' '}Resi:{selectedTree.characteristics.resilience.toFixed(2)}
              {' '}Repr:{selectedTree.characteristics.reproductionRate.toFixed(2)}
            </div>
          </div>
        )}

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1px',
          fontSize: '9px',
          color: '#aaa',
          marginRight: '10px',
          fontFamily: 'monospace',
          minWidth: '120px',
          lineHeight: '1.2'
        }}>
          <div style={{ fontWeight: 'bold', fontSize: '10px' }}>
            Total: {profiling.total.toFixed(2)}ms {profiling.usedGPU && <span style={{ color: '#00ff00' }}>⚡GPU</span>}
          </div>
          <div style={{ color: profiling.usedGPU ? '#00ff00' : '#ffaa00' }}>
            {profiling.usedGPU ? 'GPU' : 'CPU'}: {(profiling.usedGPU ? profiling.crowdednessGPU : profiling.crowdednessCPU).toFixed(2)}ms
          </div>
          <div>Update: {profiling.ecosystemUpdate.toFixed(2)}ms</div>
          <div>KMeans: {profiling.kMeans.toFixed(2)}ms</div>
          <div>
            Render: {profiling.render.toFixed(2)}ms
            {profiling.renderFPS > 0 && (
              <span style={{ color: profiling.renderFPS < 30 ? '#ff6666' : profiling.renderFPS < 60 ? '#ffaa00' : '#aaa' }}>
                {' '}@{profiling.renderFPS >= 1 ? Math.round(profiling.renderFPS) : profiling.renderFPS.toFixed(1)}fps
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => setIsRunning(!isRunning)}
          style={{
            padding: '10px 40px',
            fontSize: '18px',
            cursor: 'pointer',
            backgroundColor: isRunning ? '#aa2222' : '#22aa22',
            color: 'white',
            border: 'none',
            borderRadius: '8px'
          }}
        >
          {isRunning ? 'Stop' : 'Go'}
        </button>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <button
            onClick={decreaseSpeed}
            disabled={speed === 1}
            style={{
              padding: '8px 12px',
              fontSize: '16px',
              cursor: speed === 1 ? 'not-allowed' : 'pointer',
              backgroundColor: '#333',
              color: speed === 1 ? '#666' : 'white',
              border: 'none',
              borderRadius: '4px'
            }}
          >
            ◀
          </button>
          <div style={{
            fontSize: '16px',
            color: 'white',
            minWidth: '40px',
            textAlign: 'center'
          }}>
            x{speed}
          </div>
          <button
            onClick={increaseSpeed}
            disabled={speed === 50}
            style={{
              padding: '8px 12px',
              fontSize: '16px',
              cursor: speed === 50 ? 'not-allowed' : 'pointer',
              backgroundColor: '#333',
              color: speed === 50 ? '#666' : 'white',
              border: 'none',
              borderRadius: '4px'
            }}
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  )
}

export default App

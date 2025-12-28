import { useEffect, useRef, useState } from 'react'
import * as PIXI from 'pixi.js'
import {
  initializeEcosystem,
  updateEcosystem,
  getTreeColor,
  getDeerColor,
  getWolfColor,
  GRID_SIZE,
  TREE_BOUNDS,
  DEER_BOUNDS,
  WOLF_BOUNDS,
  DEFAULT_TREE_COUNT,
  DEFAULT_DEER_COUNT,
  DEFAULT_WOLF_COUNT,
  createTreeCharacteristics,
  createDeerCharacteristics,
  createWolfCharacteristics,
  treeIdGenerator,
  deerIdGenerator,
  wolfIdGenerator,
  getCell,
  type Ecosystem,
  type Tree,
  type Deer,
  type Wolf
} from './model/model'
import './App.css'

// Characteristic descriptions
const TREE_DESCRIPTIONS: Record<string, string> = {
  MaxSize: 'Maximum tree size when fully grown',
  AgeToSpread: 'Age in ticks before tree can reproduce',
  SpreadDistance: 'How far seeds can spread when reproducing',
  DeathChance: 'Probability of natural death each tick',
  SpreadChance: 'Probability of reproduction each tick (if old enough)',
  OptimalMoisture: 'Preferred moisture level (0-1); affects growth rate',
  CrowdingSusceptibility: 'How much crowding reduces growth and increases death'
}

const DEER_DESCRIPTIONS: Record<string, string> = {
  MaxSize: 'Maximum deer size',
  Speed: 'Movement distance per tick',
  DeathChance: 'Probability of natural death each tick',
  ReproduceChance: 'Probability of reproduction each tick (needs 1.0+ energy, costs 0.5 energy)',
  CrowdingSusceptibility: 'How much nearby deer increase death chance',
  MaxEatableSize: 'Maximum tree size this deer can eat',
  EnergyNeeds: 'Energy consumed per tick'
}

const WOLF_DESCRIPTIONS: Record<string, string> = {
  MaxSize: 'Maximum wolf size',
  Speed: 'Movement distance per tick',
  DeathChance: 'Probability of natural death each tick',
  ReproduceChance: 'Probability of reproduction each tick (needs 1.0+ energy, costs 0.6 energy)',
  CrowdingSusceptibility: 'How much nearby wolves increase death chance',
  EnergyNeeds: 'Energy consumed per tick'
}

function App() {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [treeCount, setTreeCount] = useState(0)
  const [deerCount, setDeerCount] = useState(0)
  const [wolfCount, setWolfCount] = useState(0)
  const [avgCharacteristics, setAvgCharacteristics] = useState({
    OptimalMoisture: 0,
    SpreadChance: 0,
    CrowdingSusceptibility: 0
  })
  const [selectedTree] = useState<Tree | null>(null)
  const [profiling, setProfiling] = useState({
    ecosystemUpdate: 0,
    render: 0,
    total: 0,
    renderFPS: 0
  })
  const [populationHistory, setPopulationHistory] = useState<Array<{tick: number, trees: number, deer: number, wolves: number}>>([])

  // Interactive controls state
  const [treeSliders, setTreeSliders] = useState<Record<string, number>>({})
  const [treeRandoms, setTreeRandoms] = useState<Record<string, boolean>>({})
  const [deerSliders, setDeerSliders] = useState<Record<string, number>>({})
  const [deerRandoms, setDeerRandoms] = useState<Record<string, boolean>>({})
  const [wolfSliders, setWolfSliders] = useState<Record<string, number>>({})
  const [wolfRandoms, setWolfRandoms] = useState<Record<string, boolean>>({})
  const [addTreeCount, setAddTreeCount] = useState(DEFAULT_TREE_COUNT)
  const [addDeerCount, setAddDeerCount] = useState(DEFAULT_DEER_COUNT)
  const [addWolfCount, setAddWolfCount] = useState(DEFAULT_WOLF_COUNT)
  const [pixiInitialized, setPixiInitialized] = useState(0)
  const [treeCullPercent, setTreeCullPercent] = useState(80)
  const [deerCullPercent, setDeerCullPercent] = useState(80)
  const [wolfCullPercent, setWolfCullPercent] = useState(80)
  const [immortalDeer, setImmortalDeer] = useState(true)
  const [immortalWolf, setImmortalWolf] = useState(true)

  const pixiAppRef = useRef<PIXI.Application | null>(null)
  const pixiContainerRef = useRef<HTMLDivElement>(null)
  const ecosystemRef = useRef<Ecosystem | null>(null)
  const treeGraphicsRef = useRef<PIXI.Graphics | null>(null)
  const deerGraphicsRef = useRef<PIXI.Graphics | null>(null)
  const wolfGraphicsRef = useRef<PIXI.Graphics | null>(null)
  const totalTicksRef = useRef(0)
  const lastRenderTimeRef = useRef(0)
  const lastRenderAttemptRef = useRef(0)
  const renderTimesRef = useRef<number[]>([])
  const skippedFramesRef = useRef(0)

  // Initialize sliders with random values on mount
  useEffect(() => {
    const initTreeSliders: Record<string, number> = {}
    Object.keys(TREE_BOUNDS).forEach(key => {
      initTreeSliders[key] = Math.random()
    })
    setTreeSliders(initTreeSliders)
    setTreeRandoms({})

    const initDeerSliders: Record<string, number> = {}
    Object.keys(DEER_BOUNDS).forEach(key => {
      initDeerSliders[key] = Math.random()
    })
    setDeerSliders(initDeerSliders)
    setDeerRandoms({})

    const initWolfSliders: Record<string, number> = {}
    Object.keys(WOLF_BOUNDS).forEach(key => {
      initWolfSliders[key] = Math.random()
    })
    setWolfSliders(initWolfSliders)
    setWolfRandoms({})
  }, [])

  useEffect(() => {
    if (!pixiContainerRef.current) return

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

      if (!pixiContainerRef.current) return

      // Clear any existing canvas before appending (fixes HMR issue)
      pixiContainerRef.current.innerHTML = ''
      pixiContainerRef.current.appendChild(app.canvas)
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

      // Signal that Pixi is ready (triggers render loop restart)
      setPixiInitialized(prev => prev + 1)
    }

    initPixi()

    return () => {
      if (pixiAppRef.current) {
        pixiAppRef.current.destroy(true, { children: true })
        pixiAppRef.current = null
      }
      // Clear graphics refs on cleanup
      treeGraphicsRef.current = null
      deerGraphicsRef.current = null
      wolfGraphicsRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!isRunning || !ecosystemRef.current) return

    const interval = setInterval(() => {
      if (ecosystemRef.current) {
        const overallStart = performance.now()
        let ecosystemTime = 0

        // Update ecosystem
        const ecosystemStart = performance.now()
        updateEcosystem(ecosystemRef.current, undefined, immortalDeer, immortalWolf)
        ecosystemTime = performance.now() - ecosystemStart

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

        const totalTime = performance.now() - overallStart

        setProfiling({
          ecosystemUpdate: ecosystemTime,
          render: lastRenderTimeRef.current,  // Use persisted render time from ref
          total: totalTime,
          renderFPS: 0  // Will be updated in render loop
        })
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

        // Render if enough time has passed
        if (timeSinceLastRender >= minRenderInterval) {
          // Attempt render
          lastRenderAttemptRef.current = now
          const renderStart = performance.now()
          renderTrees(pixiAppRef.current, ecosystemRef.current)
          const renderTime = performance.now() - renderStart

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
        }
      }
      animationFrameId = requestAnimationFrame(render)
    }

    animationFrameId = requestAnimationFrame(render)

    return () => cancelAnimationFrame(animationFrameId)
  }, [isRunning, pixiInitialized])

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

  const randomizeTreeSliders = () => {
    const newSliders: Record<string, number> = {}
    Object.keys(TREE_BOUNDS).forEach(key => {
      newSliders[key] = Math.random()
    })
    setTreeSliders(newSliders)
  }

  const randomizeDeerSliders = () => {
    const newSliders: Record<string, number> = {}
    Object.keys(DEER_BOUNDS).forEach(key => {
      newSliders[key] = Math.random()
    })
    setDeerSliders(newSliders)
  }

  const randomizeWolfSliders = () => {
    const newSliders: Record<string, number> = {}
    Object.keys(WOLF_BOUNDS).forEach(key => {
      newSliders[key] = Math.random()
    })
    setWolfSliders(newSliders)
  }

  const toggleAllTreeRandoms = () => {
    const allChecked = Object.keys(TREE_BOUNDS).every(key => treeRandoms[key])
    const newRandoms: Record<string, boolean> = {}
    Object.keys(TREE_BOUNDS).forEach(key => {
      newRandoms[key] = !allChecked
    })
    setTreeRandoms(newRandoms)
  }

  const toggleAllDeerRandoms = () => {
    const allChecked = Object.keys(DEER_BOUNDS).every(key => deerRandoms[key])
    const newRandoms: Record<string, boolean> = {}
    Object.keys(DEER_BOUNDS).forEach(key => {
      newRandoms[key] = !allChecked
    })
    setDeerRandoms(newRandoms)
  }

  const toggleAllWolfRandoms = () => {
    const allChecked = Object.keys(WOLF_BOUNDS).every(key => wolfRandoms[key])
    const newRandoms: Record<string, boolean> = {}
    Object.keys(WOLF_BOUNDS).forEach(key => {
      newRandoms[key] = !allChecked
    })
    setWolfRandoms(newRandoms)
  }

  const addTrees = () => {
    if (!ecosystemRef.current || !pixiAppRef.current) return
    const count = addTreeCount
    const sliders = Object.fromEntries(
      Object.keys(TREE_BOUNDS).map(key => [
        key,
        treeRandoms[key] ? null : treeSliders[key]
      ])
    )

    for (let i = 0; i < count; i++) {
      const tree: Tree = {
        id: treeIdGenerator.next(),
        x: Math.random(),
        y: Math.random(),
        age: 0,
        size: 0,
        characteristics: createTreeCharacteristics(sliders)
      }
      ecosystemRef.current.trees.push(tree)
      const cell = getCell(tree)
      ecosystemRef.current.grid.set(cell, [...(ecosystemRef.current.grid.get(cell) || []), tree])
    }

    updateStatistics(ecosystemRef.current)
    renderTrees(pixiAppRef.current, ecosystemRef.current)
  }

  const addDeer = () => {
    if (!ecosystemRef.current || !pixiAppRef.current) return
    const count = addDeerCount
    const sliders = Object.fromEntries(
      Object.keys(DEER_BOUNDS).map(key => [
        key,
        deerRandoms[key] ? null : deerSliders[key]
      ])
    )

    for (let i = 0; i < count; i++) {
      const deer: Deer = {
        id: deerIdGenerator.next(),
        x: Math.random(),
        y: Math.random(),
        age: 0,
        energy: 1.5,
        characteristics: createDeerCharacteristics(sliders)
      }
      ecosystemRef.current.deer.push(deer)
    }

    updateStatistics(ecosystemRef.current)
    renderTrees(pixiAppRef.current, ecosystemRef.current)
  }

  const addWolves = () => {
    if (!ecosystemRef.current || !pixiAppRef.current) return
    const count = addWolfCount
    const sliders = Object.fromEntries(
      Object.keys(WOLF_BOUNDS).map(key => [
        key,
        wolfRandoms[key] ? null : wolfSliders[key]
      ])
    )

    for (let i = 0; i < count; i++) {
      const wolf: Wolf = {
        id: wolfIdGenerator.next(),
        x: Math.random(),
        y: Math.random(),
        age: 0,
        energy: 1.5,
        characteristics: createWolfCharacteristics(sliders)
      }
      ecosystemRef.current.wolves.push(wolf)
    }

    updateStatistics(ecosystemRef.current)
    renderTrees(pixiAppRef.current, ecosystemRef.current)
  }

  const cullTrees = () => {
    if (!ecosystemRef.current || !pixiAppRef.current) return
    const currentCount = ecosystemRef.current.trees.length
    const cullCount = Math.floor((currentCount * treeCullPercent) / 100)

    // Randomly select trees to remove
    for (let i = 0; i < cullCount; i++) {
      if (ecosystemRef.current.trees.length === 0) break
      const randomIndex = Math.floor(Math.random() * ecosystemRef.current.trees.length)
      const tree = ecosystemRef.current.trees[randomIndex]

      // Remove from grid
      const cellKey = getCell(tree)
      const cell = ecosystemRef.current.grid.get(cellKey)
      if (cell) {
        const cellIndex = cell.findIndex((t) => t.id === tree.id)
        if (cellIndex !== -1) {
          cell.splice(cellIndex, 1)
        }
      }

      // Remove from trees array
      ecosystemRef.current.trees.splice(randomIndex, 1)
    }

    updateStatistics(ecosystemRef.current)
    renderTrees(pixiAppRef.current, ecosystemRef.current)
  }

  const cullDeer = () => {
    if (!ecosystemRef.current || !pixiAppRef.current) return
    const currentCount = ecosystemRef.current.deer.length
    const cullCount = Math.floor((currentCount * deerCullPercent) / 100)

    // Randomly select deer to remove
    for (let i = 0; i < cullCount; i++) {
      if (ecosystemRef.current.deer.length === 0) break
      const randomIndex = Math.floor(Math.random() * ecosystemRef.current.deer.length)
      ecosystemRef.current.deer.splice(randomIndex, 1)
    }

    updateStatistics(ecosystemRef.current)
    renderTrees(pixiAppRef.current, ecosystemRef.current)
  }

  const cullWolves = () => {
    if (!ecosystemRef.current || !pixiAppRef.current) return
    const currentCount = ecosystemRef.current.wolves.length
    const cullCount = Math.floor((currentCount * wolfCullPercent) / 100)

    // Randomly select wolves to remove
    for (let i = 0; i < cullCount; i++) {
      if (ecosystemRef.current.wolves.length === 0) break
      const randomIndex = Math.floor(Math.random() * ecosystemRef.current.wolves.length)
      ecosystemRef.current.wolves.splice(randomIndex, 1)
    }

    updateStatistics(ecosystemRef.current)
    renderTrees(pixiAppRef.current, ecosystemRef.current)
  }

  const resetEcosystem = () => {
    if (!ecosystemRef.current || !pixiAppRef.current) return

    // Clear existing ecosystem
    ecosystemRef.current.trees = []
    ecosystemRef.current.grid.clear()
    ecosystemRef.current.deer = []
    ecosystemRef.current.wolves = []

    // Reset tick counter
    totalTicksRef.current = 0
    setPopulationHistory([])

    // Add new entities with current slider settings
    addTrees()
    addDeer()
    addWolves()

    updateStatistics(ecosystemRef.current)
    renderTrees(pixiAppRef.current, ecosystemRef.current)
  }

  const updateStatistics = (ecosystem: Ecosystem) => {
    setTreeCount(ecosystem.trees.length)
    setDeerCount(ecosystem.deer.length)
    setWolfCount(ecosystem.wolves.length)

    if (ecosystem.trees.length === 0) {
      setAvgCharacteristics({ OptimalMoisture: 0, SpreadChance: 0, CrowdingSusceptibility: 0 })
      return
    }

    const totals = ecosystem.trees.reduce(
      (acc, tree) => ({
        OptimalMoisture: acc.OptimalMoisture + tree.characteristics.OptimalMoisture,
        SpreadChance: acc.SpreadChance + tree.characteristics.SpreadChance,
        CrowdingSusceptibility: acc.CrowdingSusceptibility + tree.characteristics.CrowdingSusceptibility
      }),
      { OptimalMoisture: 0, SpreadChance: 0, CrowdingSusceptibility: 0 }
    )

    setAvgCharacteristics({
      OptimalMoisture: totals.OptimalMoisture / ecosystem.trees.length,
      SpreadChance: totals.SpreadChance / ecosystem.trees.length,
      CrowdingSusceptibility: totals.CrowdingSusceptibility / ecosystem.trees.length
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
    // Check if graphics exist AND are still in the current stage
    if (!treeGraphicsRef.current || treeGraphicsRef.current.parent !== app.stage) {
      treeGraphicsRef.current = new PIXI.Graphics()
      app.stage.addChild(treeGraphicsRef.current)
    }

    if (!deerGraphicsRef.current || deerGraphicsRef.current.parent !== app.stage) {
      deerGraphicsRef.current = new PIXI.Graphics()
      app.stage.addChild(deerGraphicsRef.current)
    }

    if (!wolfGraphicsRef.current || wolfGraphicsRef.current.parent !== app.stage) {
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
        {/* Pixi Canvas Container */}
        <div ref={pixiContainerRef} style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0
        }} />

        {/* Control Panel */}
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          width: '320px',
          maxHeight: 'calc(100vh - 100px)',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          color: 'white',
          padding: '12px',
          borderRadius: '8px',
          fontFamily: 'monospace',
          fontSize: '11px',
          overflowY: 'auto',
          zIndex: 1000
        }}>
          {/* Trees Section */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '6px', color: '#22dd22', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'absolute', left: '0' }}>
                <button
                  onClick={cullTrees}
                  style={{
                    cursor: 'pointer',
                    fontSize: '14px',
                    userSelect: 'none',
                    backgroundColor: '#444',
                    border: '1px solid #666',
                    borderRadius: '4px',
                    padding: '2px 4px',
                    lineHeight: '1'
                  }}
                  title="Remove % of tree population"
                >🔥🔥🔥</button>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={treeCullPercent}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1
                    setTreeCullPercent(Math.max(1, Math.min(100, val)))
                  }}
                  style={{
                    width: '40px',
                    padding: '2px 4px',
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    textAlign: 'right'
                  }}
                />
                <span style={{ fontSize: '10px' }}>%</span>
              </div>
              <span style={{ flex: 1, textAlign: 'center' }}>TREES</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'absolute', right: '0' }}>
                <span
                  onClick={randomizeTreeSliders}
                  style={{ cursor: 'pointer', fontSize: '16px', userSelect: 'none' }}
                  title="Randomize all sliders"
                >🎰</span>
                <label style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={Object.keys(TREE_BOUNDS).every(key => treeRandoms[key])}
                    onChange={toggleAllTreeRandoms}
                    style={{ display: 'none' }}
                  />
                  <span style={{
                    display: 'inline-block',
                    width: '20px',
                    textAlign: 'center',
                    fontSize: '18px',
                    opacity: Object.keys(TREE_BOUNDS).every(key => treeRandoms[key]) ? 1 : 0.3
                  }} title="Toggle all random">💥</span>
                </label>
              </div>
            </div>
            {Object.keys(TREE_BOUNDS).map(key => (
              <div key={key} style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '100px', fontSize: '10px' }} title={TREE_DESCRIPTIONS[key]}>{key}:</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={treeSliders[key] || 0}
                  onChange={(e) => setTreeSliders({ ...treeSliders, [key]: parseFloat(e.target.value) })}
                  style={{ flex: 1, opacity: treeRandoms[key] ? 0.3 : 1, height: '4px' }}
                  disabled={treeRandoms[key]}
                  className="compact-slider"
                  title={`${TREE_DESCRIPTIONS[key]} (${TREE_BOUNDS[key as keyof typeof TREE_BOUNDS].min} - ${TREE_BOUNDS[key as keyof typeof TREE_BOUNDS].max})`}
                />
                <label style={{ cursor: 'pointer', userSelect: 'none', width: '20px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={treeRandoms[key] || false}
                    onChange={(e) => setTreeRandoms({ ...treeRandoms, [key]: e.target.checked })}
                    style={{ display: 'none' }}
                  />
                  <span style={{
                    display: 'inline-block',
                    width: '20px',
                    height: '20px',
                    lineHeight: '20px',
                    textAlign: 'center',
                    fontSize: '14px',
                    opacity: treeRandoms[key] ? 1 : 0.3
                  }}>💥</span>
                </label>
              </div>
            ))}
            <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '100px', fontSize: '10px' }}>Count:</span>
              <input
                type="number"
                value={addTreeCount}
                onChange={(e) => setAddTreeCount(parseInt(e.target.value) || 0)}
                style={{ flex: 1, padding: '4px', fontSize: '11px', fontFamily: 'monospace' }}
              />
              <button
                onClick={addTrees}
                style={{
                  padding: '4px 8px',
                  fontSize: '10px',
                  cursor: 'pointer',
                  backgroundColor: '#22dd22',
                  border: 'none',
                  borderRadius: '4px',
                  fontFamily: 'monospace'
                }}
              >
                Add
              </button>
            </div>
          </div>

          {/* Deer Section */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '6px', color: '#d4a574', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'absolute', left: '0' }}>
                <button
                  onClick={cullDeer}
                  style={{
                    cursor: 'pointer',
                    fontSize: '14px',
                    userSelect: 'none',
                    backgroundColor: '#444',
                    border: '1px solid #666',
                    borderRadius: '4px',
                    padding: '2px 4px',
                    lineHeight: '1'
                  }}
                  title="Remove % of deer population"
                >🔥🔥🔥</button>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={deerCullPercent}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1
                    setDeerCullPercent(Math.max(1, Math.min(100, val)))
                  }}
                  style={{
                    width: '40px',
                    padding: '2px 4px',
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    textAlign: 'right'
                  }}
                />
                <span style={{ fontSize: '10px' }}>%</span>
              </div>
              <span style={{ flex: 1, textAlign: 'center' }}>DEER</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'absolute', right: '0' }}>
                <span
                  onClick={randomizeDeerSliders}
                  style={{ cursor: 'pointer', fontSize: '16px', userSelect: 'none' }}
                  title="Randomize all sliders"
                >🎰</span>
                <label style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={Object.keys(DEER_BOUNDS).every(key => deerRandoms[key])}
                    onChange={toggleAllDeerRandoms}
                    style={{ display: 'none' }}
                  />
                  <span style={{
                    display: 'inline-block',
                    width: '20px',
                    textAlign: 'center',
                    fontSize: '18px',
                    opacity: Object.keys(DEER_BOUNDS).every(key => deerRandoms[key]) ? 1 : 0.3
                  }} title="Toggle all random">💥</span>
                </label>
              </div>
            </div>
            {Object.keys(DEER_BOUNDS).map(key => (
              <div key={key} style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '100px', fontSize: '10px' }} title={DEER_DESCRIPTIONS[key]}>{key}:</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={deerSliders[key] || 0}
                  onChange={(e) => setDeerSliders({ ...deerSliders, [key]: parseFloat(e.target.value) })}
                  style={{ flex: 1, opacity: deerRandoms[key] ? 0.3 : 1, height: '4px' }}
                  disabled={deerRandoms[key]}
                  className="compact-slider"
                  title={`${DEER_DESCRIPTIONS[key]} (${DEER_BOUNDS[key as keyof typeof DEER_BOUNDS].min} - ${DEER_BOUNDS[key as keyof typeof DEER_BOUNDS].max})`}
                />
                <label style={{ cursor: 'pointer', userSelect: 'none', width: '20px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={deerRandoms[key] || false}
                    onChange={(e) => setDeerRandoms({ ...deerRandoms, [key]: e.target.checked })}
                    style={{ display: 'none' }}
                  />
                  <span style={{
                    display: 'inline-block',
                    width: '20px',
                    height: '20px',
                    lineHeight: '20px',
                    textAlign: 'center',
                    fontSize: '14px',
                    opacity: deerRandoms[key] ? 1 : 0.3
                  }}>💥</span>
                </label>
              </div>
            ))}
            <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '100px', fontSize: '10px' }}>Count:</span>
              <input
                type="number"
                value={addDeerCount}
                onChange={(e) => setAddDeerCount(parseInt(e.target.value) || 0)}
                style={{ flex: 1, padding: '4px', fontSize: '11px', fontFamily: 'monospace' }}
              />
              <button
                onClick={addDeer}
                style={{
                  padding: '4px 8px',
                  fontSize: '10px',
                  cursor: 'pointer',
                  backgroundColor: '#d4a574',
                  border: 'none',
                  borderRadius: '4px',
                  fontFamily: 'monospace'
                }}
              >
                Add
              </button>
            </div>
          </div>

          {/* Wolves Section */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '6px', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'absolute', left: '0' }}>
                <button
                  onClick={cullWolves}
                  style={{
                    cursor: 'pointer',
                    fontSize: '14px',
                    userSelect: 'none',
                    backgroundColor: '#444',
                    border: '1px solid #666',
                    borderRadius: '4px',
                    padding: '2px 4px',
                    lineHeight: '1'
                  }}
                  title="Remove % of wolf population"
                >🔥🔥🔥</button>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={wolfCullPercent}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1
                    setWolfCullPercent(Math.max(1, Math.min(100, val)))
                  }}
                  style={{
                    width: '40px',
                    padding: '2px 4px',
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    textAlign: 'right'
                  }}
                />
                <span style={{ fontSize: '10px' }}>%</span>
              </div>
              <span style={{ flex: 1, textAlign: 'center' }}>WOLVES</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'absolute', right: '0' }}>
                <span
                  onClick={randomizeWolfSliders}
                  style={{ cursor: 'pointer', fontSize: '16px', userSelect: 'none' }}
                  title="Randomize all sliders"
                >🎰</span>
                <label style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={Object.keys(WOLF_BOUNDS).every(key => wolfRandoms[key])}
                    onChange={toggleAllWolfRandoms}
                    style={{ display: 'none' }}
                  />
                  <span style={{
                    display: 'inline-block',
                    width: '20px',
                    textAlign: 'center',
                    fontSize: '18px',
                    opacity: Object.keys(WOLF_BOUNDS).every(key => wolfRandoms[key]) ? 1 : 0.3
                  }} title="Toggle all random">💥</span>
                </label>
              </div>
            </div>
            {Object.keys(WOLF_BOUNDS).map(key => (
              <div key={key} style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '100px', fontSize: '10px' }} title={WOLF_DESCRIPTIONS[key]}>{key}:</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={wolfSliders[key] || 0}
                  onChange={(e) => setWolfSliders({ ...wolfSliders, [key]: parseFloat(e.target.value) })}
                  style={{ flex: 1, opacity: wolfRandoms[key] ? 0.3 : 1, height: '4px' }}
                  disabled={wolfRandoms[key]}
                  className="compact-slider"
                  title={`${WOLF_DESCRIPTIONS[key]} (${WOLF_BOUNDS[key as keyof typeof WOLF_BOUNDS].min} - ${WOLF_BOUNDS[key as keyof typeof WOLF_BOUNDS].max})`}
                />
                <label style={{ cursor: 'pointer', userSelect: 'none', width: '20px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={wolfRandoms[key] || false}
                    onChange={(e) => setWolfRandoms({ ...wolfRandoms, [key]: e.target.checked })}
                    style={{ display: 'none' }}
                  />
                  <span style={{
                    display: 'inline-block',
                    width: '20px',
                    height: '20px',
                    lineHeight: '20px',
                    textAlign: 'center',
                    fontSize: '14px',
                    opacity: wolfRandoms[key] ? 1 : 0.3
                  }}>💥</span>
                </label>
              </div>
            ))}
            <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '100px', fontSize: '10px' }}>Count:</span>
              <input
                type="number"
                value={addWolfCount}
                onChange={(e) => setAddWolfCount(parseInt(e.target.value) || 0)}
                style={{ flex: 1, padding: '4px', fontSize: '11px', fontFamily: 'monospace' }}
              />
              <button
                onClick={addWolves}
                style={{
                  padding: '4px 8px',
                  fontSize: '10px',
                  cursor: 'pointer',
                  backgroundColor: '#888',
                  border: 'none',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  color: 'white'
                }}
              >
                Add
              </button>
            </div>
          </div>

          {/* Reset Button */}
          <button
            onClick={resetEcosystem}
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              backgroundColor: '#ff4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontFamily: 'monospace'
            }}
          >
            RESET ECOSYSTEM
          </button>
        </div>

        {/* Population History Chart */}
        {populationHistory.length > 1 && (
          <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
            <svg width="300" height="200" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px' }}>
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
          position: 'absolute',
          left: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          fontSize: '11px',
          color: 'white'
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={immortalDeer}
              onChange={(e) => setImmortalDeer(e.target.checked)}
            />
            <span>1 immortal deer</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={immortalWolf}
              onChange={(e) => setImmortalWolf(e.target.checked)}
            />
            <span>1 immortal wolf</span>
          </label>
        </div>
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
            OptM:{avgCharacteristics.OptimalMoisture.toFixed(2)}
            {' '}Sprd:{avgCharacteristics.SpreadChance.toFixed(2)}
            {' '}Crwd:{avgCharacteristics.CrowdingSusceptibility.toFixed(2)}
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
              OptM:{selectedTree.characteristics.OptimalMoisture.toFixed(2)}
              {' '}Sprd:{selectedTree.characteristics.SpreadChance.toFixed(2)}
              {' '}Crwd:{selectedTree.characteristics.CrowdingSusceptibility.toFixed(2)}
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
            Total: {profiling.total.toFixed(2)}ms
          </div>
          <div>Update: {profiling.ecosystemUpdate.toFixed(2)}ms</div>
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

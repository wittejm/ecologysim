import { useEffect, useRef, useState } from 'react'
import * as PIXI from 'pixi.js'
import { initializeEcosystem, TreeSpeciesProps, updateEcosystem, type Ecosystem } from './model/model'
import './App.css'

function App() {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [speed, setSpeed] = useState(1) // 1, 2, 5, or 10
  const [treeCounts, setTreeCounts] = useState({ Pine: 0, Maple: 0, Oak: 0 })
  const [computeTime, setComputeTime] = useState(0)
  const pixiAppRef = useRef<PIXI.Application | null>(null)
  const ecosystemRef = useRef<Ecosystem | null>(null)
  const graphicsCache = useRef<Map<number, PIXI.Graphics>>(new Map())
  const lastTreeCountRef = useRef(0)

  useEffect(() => {
    if (!canvasRef.current) return

    const initPixi = async () => {
      // Initialize PIXI app
      const app = new PIXI.Application()

      const buttonHeight = 60 // Fixed button area height
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

      // Initialize ecosystem
      const ecosystem = initializeEcosystem()
      ecosystemRef.current = ecosystem

      // Render trees and update counts
      renderTrees(app, ecosystem)
      updateTreeCounts(ecosystem)
    }

    initPixi()

    return () => {
      if (pixiAppRef.current) {
        pixiAppRef.current.destroy(true, { children: true })
      }
    }
  }, [])

  // Simulation update loop (runs at specified speed)
  useEffect(() => {
    if (!isRunning || !ecosystemRef.current) return

    const interval = setInterval(() => {
      if (ecosystemRef.current) {
        const startTime = performance.now()
        updateEcosystem(ecosystemRef.current)
        updateTreeCounts(ecosystemRef.current)
        const endTime = performance.now()
        setComputeTime(endTime - startTime)
      }
    }, 1000 / speed)

    return () => clearInterval(interval)
  }, [isRunning, speed])

  // Rendering loop (runs at display refresh rate)
  useEffect(() => {
    if (!isRunning || !pixiAppRef.current || !ecosystemRef.current) return

    let animationFrameId: number

    const render = () => {
      if (pixiAppRef.current && ecosystemRef.current) {
        // Only render if tree count changed (indicating ecosystem changed)
        const currentTreeCount = ecosystemRef.current.trees.length
        if (currentTreeCount !== lastTreeCountRef.current) {
          renderTrees(pixiAppRef.current, ecosystemRef.current)
          lastTreeCountRef.current = currentTreeCount
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
  }

  const decreaseSpeed = () => {
    if (speed === 10) setSpeed(5)
    else if (speed === 5) setSpeed(2)
    else if (speed === 2) setSpeed(1)
  }

  const updateTreeCounts = (ecosystem: Ecosystem) => {
    const counts = { Pine: 0, Maple: 0, Oak: 0 }
    ecosystem.trees.forEach(tree => {
      counts[tree.species]++
    })
    setTreeCounts(counts)
  }

  const renderTrees = (app: PIXI.Application, ecosystem: Ecosystem) => {
    const cache = graphicsCache.current
    const width = app.screen.width
    const height = app.screen.height

    // Remove graphics for dead trees - iterate cache directly
    cache.forEach((graphic, id) => {
      let found = false
      for (const tree of ecosystem.trees) {
        if (tree.id === id) {
          found = true
          break
        }
      }
      if (!found) {
        graphic.destroy()
        cache.delete(id)
      }
    })

    // Clear the stage
    app.stage.removeChildren()
    const container = new PIXI.Container()

    ecosystem.trees.forEach(tree => {
      // Calculate radius based on size - simple thresholds
      const radius = tree.size < 3 ? 2 : tree.size < 8 ? 3.5 : 5

      // Reuse or create graphics
      let dot = cache.get(tree.id)
      if (!dot) {
        dot = new PIXI.Graphics()
        cache.set(tree.id, dot)
      }

      // Update graphics
      dot.clear()
      dot.circle(0, 0, radius)
      dot.fill(TreeSpeciesProps[tree.species].color)

      dot.x = tree.x * width
      dot.y = tree.y * height

      container.addChild(dot)
    })

    app.stage.addChild(container)
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
        height: 'calc(100vh - 60px)',
        overflow: 'hidden',
        position: 'relative'
      }} />
      <div style={{
        height: '60px',
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
          <div>Pine: {treeCounts.Pine}</div>
          <div>Maple: {treeCounts.Maple}</div>
          <div>Oak: {treeCounts.Oak}</div>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          fontSize: '12px',
          color: '#aaa',
          marginRight: '10px'
        }}>
          <div>Compute: {computeTime.toFixed(2)}ms</div>
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
            disabled={speed === 10}
            style={{
              padding: '8px 12px',
              fontSize: '16px',
              cursor: speed === 10 ? 'not-allowed' : 'pointer',
              backgroundColor: '#333',
              color: speed === 10 ? '#666' : 'white',
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

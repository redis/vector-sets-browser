import { useRef, useEffect, useState, useLayoutEffect } from "react"

interface VectorHeatmapRendererProps {
    vector: number[] | null
    className?: string
    cellSize?: number
    showStats?: boolean
    width?: number
    height?: number
}

export default function VectorHeatmapRenderer({ 
    vector, 
    className = "",
    cellSize: initialCellSize,
    showStats = false,
    width,
    height
}: VectorHeatmapRendererProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [hoveredCell, setHoveredCell] = useState<{ index: number; value: number } | null>(null)
    const [cellSize, setCellSize] = useState(initialCellSize || 20)
    const [isCanvasReady, setIsCanvasReady] = useState(false)
    const [forceRender, setForceRender] = useState(0)

    // Calculate optimal dimensions based on vector length
    const getDimensions = (length: number, size: number) => {
        const cols = Math.min(Math.ceil(Math.sqrt(length)), 32)
        const rows = Math.ceil(length / cols)
        return { cols, rows }
    }

    // Monitor canvas ref availability
    useEffect(() => {
        if (canvasRef.current) {
            setIsCanvasReady(true)
        } else {
            setIsCanvasReady(false)
        }
    }, [forceRender])

    // Draw to canvas using useLayoutEffect for synchronous DOM measurements/mutations
    useLayoutEffect(() => {
        if (!vector || !canvasRef.current || !isCanvasReady) {
            console.log("VectorHeatmapRenderer: Skipping render - prerequisites not met", {
                hasVector: !!vector,
                vectorLength: vector?.length,
                hasCanvasRef: !!canvasRef.current,
                isCanvasReady
            });
            return;
        }

        // Validate the vector data
        if (!Array.isArray(vector) || vector.length === 0 || vector.some(v => typeof v !== 'number' || isNaN(v) || !isFinite(v))) {
            console.error("VectorHeatmapRenderer: Invalid vector data", {
                isArray: Array.isArray(vector),
                length: vector?.length,
                hasInvalidValues: vector?.some(v => typeof v !== 'number' || isNaN(v) || !isFinite(v))
            });
            return;
        }

        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) {
            console.error("VectorHeatmapRenderer: Failed to get canvas context")
            return
        }

        // Determine optimal cell size based on vector length
        let optimalCellSize = initialCellSize || 20
        if (!initialCellSize) {
            if (vector.length > 1000) optimalCellSize = 12
            else if (vector.length > 500) optimalCellSize = 16
        }
        setCellSize(optimalCellSize)

        // Determine grid dimensions
        const { cols, rows } = getDimensions(vector.length, optimalCellSize)

        // Set canvas size
        if (width && height) {
            canvas.width = width
            canvas.height = height
            
            // If fixed dimensions are provided, adjust cell size to fit
            const adjustedCellWidth = width / cols
            const adjustedCellHeight = height / rows
            optimalCellSize = Math.min(adjustedCellWidth, adjustedCellHeight)
        } else {
            canvas.width = cols * optimalCellSize
            canvas.height = rows * optimalCellSize
        }

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // Draw heatmap
        vector.forEach((value, index) => {
            drawCell(ctx, index, value, cols, optimalCellSize)
        })

        // Add hover handler only if showStats is true
        if (showStats) {
            const handleMouseMove = (e: MouseEvent) => {
                const rect = canvas.getBoundingClientRect()
                const x = e.clientX - rect.left
                const y = e.clientY - rect.top
                
                const col = Math.floor(x / optimalCellSize)
                const row = Math.floor(y / optimalCellSize)
                
                const index = row * cols + col
                
                if (index >= 0 && index < vector.length) {
                    setHoveredCell({ index, value: vector[index] })
                } else {
                    setHoveredCell(null)
                }
            }

            const handleMouseLeave = () => {
                setHoveredCell(null)
            }

            canvas.addEventListener('mousemove', handleMouseMove)
            canvas.addEventListener('mouseleave', handleMouseLeave)

            return () => {
                canvas.removeEventListener('mousemove', handleMouseMove)
                canvas.removeEventListener('mouseleave', handleMouseLeave)
            }
        }
    }, [vector, isCanvasReady, forceRender, initialCellSize, width, height])

    // Function to draw a single cell
    const drawCell = (
        ctx: CanvasRenderingContext2D, 
        index: number, 
        value: number, 
        cols: number,
        cellSize: number
    ) => {
        try {
            const col = index % cols
            const row = Math.floor(index / cols)
            const x = col * cellSize
            const y = row * cellSize

            // Normalize value to be between -1 and 1
            const normalizedValue = Math.max(-1, Math.min(1, value))
            
            let r, g, b
            if (normalizedValue < 0) {
                // Blue to white (-1 to 0)
                const intensity = 1 + normalizedValue
                r = Math.round(255 * intensity)
                g = Math.round(255 * intensity)
                b = 255
            } else {
                // White to red (0 to 1)
                const intensity = 1 - normalizedValue
                r = 255
                g = Math.round(255 * intensity)
                b = Math.round(255 * intensity)
            }

            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
            ctx.fillRect(x, y, cellSize, cellSize)

            // Add border
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)'
            ctx.strokeRect(x, y, cellSize, cellSize)
        } catch (error) {
            console.error("Error drawing cell:", error, { index, value, cols, cellSize })
        }
    }

    // Render vector stats if requested
    const renderVectorStats = () => {
        if (!vector || vector.length === 0 || !showStats) return null

        const min = Math.min(...vector)
        const max = Math.max(...vector)
        const avg = vector.reduce((sum, val) => sum + val, 0) / vector.length

        return (
            <div className="mt-2 text-xs text-gray-600">
                {hoveredCell && (
                    <div className="p-1 bg-slate-100 rounded text-center">
                        <p><strong>Dim {hoveredCell.index}:</strong> {hoveredCell.value.toFixed(4)}</p>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className={className}>
            <canvas 
                ref={canvasRef} 
                style={{ 
                    display: 'block',
                    width: width || 'auto',
                    height: height || 'auto'
                }} 
            />
            {renderVectorStats()}
        </div>
    )
} 
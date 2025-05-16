import { useRef, useEffect, useState, useLayoutEffect } from "react"

interface VectorHeatmapRendererProps {
    vector: number[] | null
    className?: string
    size?: number
    showStats?: boolean
}

export default function VectorHeatmapRenderer({ 
    vector, 
    className = "",
    size = 300,
    showStats = false
}: VectorHeatmapRendererProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [hoveredCell, setHoveredCell] = useState<{ index: number; value: number } | null>(null)
    const [isCanvasReady, setIsCanvasReady] = useState(false)
    const [forceRender, setForceRender] = useState(0)

    // Calculate optimal grid dimensions based on vector length
    const getGridDimensions = (length: number) => {
        const cols = Math.ceil(Math.sqrt(length))
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

        // Determine grid dimensions
        const { cols, rows } = getGridDimensions(vector.length)

        // Set canvas size to be square
        canvas.width = size
        canvas.height = size

        // Calculate cell size to fit the grid in the square
        const cellWidth = size / cols
        const cellHeight = size / rows

        // Use the smaller dimension to ensure square cells
        const cellSize = Math.min(cellWidth, cellHeight)

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // Calculate the actual used width and height
        const usedWidth = cols * cellSize
        const usedHeight = rows * cellSize

        // Center the grid in the canvas
        const offsetX = (size - usedWidth) / 2
        const offsetY = (size - usedHeight) / 2

        // Draw heatmap
        vector.forEach((value, index) => {
            drawCell(ctx, index, value, cols, cellSize, offsetX, offsetY)
        })

        // Add hover handler only if showStats is true
        if (showStats) {
            const handleMouseMove = (e: MouseEvent) => {
                const rect = canvas.getBoundingClientRect()
                const x = e.clientX - rect.left - offsetX
                const y = e.clientY - rect.top - offsetY
                
                // Ignore if outside the grid area
                if (x < 0 || y < 0 || x >= usedWidth || y >= usedHeight) {
                    setHoveredCell(null)
                    return
                }
                
                const col = Math.floor(x / cellSize)
                const row = Math.floor(y / cellSize)
                
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
    }, [vector, isCanvasReady, forceRender, size])

    // Function to draw a single cell
    const drawCell = (
        ctx: CanvasRenderingContext2D, 
        index: number, 
        value: number, 
        cols: number,
        cellSize: number,
        offsetX: number,
        offsetY: number
    ) => {
        try {
            const col = index % cols
            const row = Math.floor(index / cols)
            const x = offsetX + col * cellSize
            const y = offsetY + row * cellSize

            // Normalize value to be between -1 and 1
            const normalizedValue = Math.max(-1, Math.min(1, value))
            
            let r, g, b
            if (normalizedValue < 0) {
                // Blue to white for negative values (-1 to 0)
                // #3b4cc0 (dark blue) → #f7f7f7 (white)
                const intensity = 1 + normalizedValue
                r = Math.round(59 + (247 - 59) * intensity)
                g = Math.round(76 + (247 - 76) * intensity)
                b = Math.round(192 + (247 - 192) * intensity)
            } else {
                // White to red for positive values (0 to 1)
                // #f7f7f7 (white) → #b40426 (red)
                const intensity = 1 - normalizedValue
                r = Math.round(180 + (247 - 180) * intensity)
                g = Math.round(4 + (247 - 4) * intensity)
                b = Math.round(38 + (247 - 38) * intensity)
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
                    width: size,
                    height: size
                }} 
            />
            {renderVectorStats()}
        </div>
    )
} 
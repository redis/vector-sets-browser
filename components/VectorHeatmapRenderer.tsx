import { useRef, useEffect, useState, useLayoutEffect } from "react"

interface VectorHeatmapRendererProps {
    vector: number[] | null
    className?: string
    size?: number
    showStats?: boolean
    scalingMode?: 'relative' | 'absolute'
    colorScheme?: 'thermal' | 'viridis' | 'classic'
}

export default function VectorHeatmapRenderer({ 
    vector, 
    className = "",
    size = 300,
    showStats = false,
    scalingMode = 'relative',
    colorScheme = 'thermal'
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

    // Get scaling parameters based on the vector and scaling mode
    const getScalingParams = (vector: number[]) => {
        if (scalingMode === 'absolute') {
            return { min: -1, max: 1, range: 2 }
        } else {
            const min = Math.min(...vector)
            const max = Math.max(...vector)
            const range = max - min
            return { min, max, range }
        }
    }

    // Normalize value based on scaling mode
    const normalizeValue = (value: number, min: number, max: number, range: number) => {
        if (range === 0) return 0.5 // All values are the same
        if (scalingMode === 'absolute') {
            return Math.max(0, Math.min(1, (value + 1) / 2)) // Map [-1,1] to [0,1]
        } else {
            return (value - min) / range // Map [min,max] to [0,1]
        }
    }

    // Get color based on normalized value (0-1) and color scheme
    const getColor = (normalizedValue: number): [number, number, number] => {
        // Clamp to ensure we're in [0,1]
        const t = Math.max(0, Math.min(1, normalizedValue))

        switch (colorScheme) {
            case 'thermal':
                // Black -> Purple -> Red -> Orange -> Yellow -> White
                if (t < 0.2) {
                    // Black to Purple
                    const s = t / 0.2
                    return [Math.round(s * 64), 0, Math.round(s * 128)]
                } else if (t < 0.4) {
                    // Purple to Red  
                    const s = (t - 0.2) / 0.2
                    return [Math.round(64 + s * (255 - 64)), 0, Math.round(128 * (1 - s))]
                } else if (t < 0.6) {
                    // Red to Orange
                    const s = (t - 0.4) / 0.2
                    return [255, Math.round(s * 165), 0]
                } else if (t < 0.8) {
                    // Orange to Yellow
                    const s = (t - 0.6) / 0.2
                    return [255, Math.round(165 + s * (255 - 165)), 0]
                } else {
                    // Yellow to White
                    const s = (t - 0.8) / 0.2
                    return [255, 255, Math.round(s * 255)]
                }

            case 'viridis':
                // Inspired by matplotlib's viridis: Dark Purple -> Blue -> Green -> Yellow
                if (t < 0.25) {
                    const s = t / 0.25
                    return [Math.round(s * 68), Math.round(s * 1), Math.round(84 + s * (140 - 84))]
                } else if (t < 0.5) {
                    const s = (t - 0.25) / 0.25
                    return [Math.round(68 + s * (53 - 68)), Math.round(1 + s * (95 - 1)), Math.round(140 + s * (169 - 140))]
                } else if (t < 0.75) {
                    const s = (t - 0.5) / 0.25
                    return [Math.round(53 + s * (35 - 53)), Math.round(95 + s * (140 - 95)), Math.round(169 + s * (69 - 169))]
                } else {
                    const s = (t - 0.75) / 0.25
                    return [Math.round(35 + s * (253 - 35)), Math.round(140 + s * (231 - 140)), Math.round(69 + s * (37 - 69))]
                }

            case 'classic':
            default:
                // Classic blue -> white -> red scheme
                if (t < 0.5) {
                    // Blue to White
                    const s = t / 0.5
                    return [
                        Math.round(100 + s * (255 - 100)), // 100 -> 255
                        Math.round(149 + s * (255 - 149)), // 149 -> 255  
                        Math.round(237 + s * (255 - 237))  // 237 -> 255
                    ]
                } else {
                    // White to Red
                    const s = (t - 0.5) / 0.5
                    return [
                        255, // Keep at 255
                        Math.round(255 - s * (255 - 20)), // 255 -> 20
                        Math.round(255 - s * (255 - 60))  // 255 -> 60
                    ]
                }
        }
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

        // Get scaling parameters once for the entire vector
        const scalingParams = getScalingParams(vector)

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
            drawCell(ctx, index, value, cols, cellSize, offsetX, offsetY, scalingParams)
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
    }, [vector, isCanvasReady, forceRender, size, scalingMode, colorScheme])

    // Function to draw a single cell
    const drawCell = (
        ctx: CanvasRenderingContext2D, 
        index: number, 
        value: number, 
        cols: number,
        cellSize: number,
        offsetX: number,
        offsetY: number,
        scalingParams: { min: number; max: number; range: number }
    ) => {
        try {
            const col = index % cols
            const row = Math.floor(index / cols)
            const x = offsetX + col * cellSize
            const y = offsetY + row * cellSize

            // Normalize value to be between -1 and 1
            const normalizedValue = normalizeValue(value, scalingParams.min, scalingParams.max, scalingParams.range)
            
            const color = getColor(normalizedValue)

            ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`
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

        const scalingParams = getScalingParams(vector)

        return (
            <div className="mt-2 text-xs text-gray-600">
                <div className="mb-1 p-1 bg-slate-50 rounded text-center">
                    <p><strong>Length:</strong> {vector.length} | <strong>Mode:</strong> {scalingMode}</p>
                    <p><strong>Range:</strong> {scalingParams.min.toFixed(4)} to {scalingParams.max.toFixed(4)}</p>
                </div>
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
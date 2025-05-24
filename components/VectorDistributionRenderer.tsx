import { useRef, useEffect, useState } from "react"

interface VectorDistributionRendererProps {
    vector: number[] | null
    className?: string
    size?: number
    showStats?: boolean
    scalingMode?: 'relative' | 'absolute'
    colorScheme?: 'thermal' | 'viridis' | 'classic'
}

export default function VectorDistributionRenderer({
    vector,
    className = "",
    size = 300,
    showStats = false,
    scalingMode = 'relative',
    colorScheme = 'thermal'
}: VectorDistributionRendererProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [hoveredBin, setHoveredBin] = useState<{ index: number; count: number; range: string } | null>(null)
    const [isCanvasReady, setIsCanvasReady] = useState(false)

    // Determine if this is a mini view (simplified rendering)
    const isMiniView = size <= 100

    // Get color based on normalized value (0-1) and color scheme
    const getColor = (normalizedValue: number): [number, number, number] => {
        const t = Math.max(0, Math.min(1, normalizedValue))

        switch (colorScheme) {
            case 'thermal':
                if (t < 0.2) {
                    const s = t / 0.2
                    return [Math.round(s * 64), 0, Math.round(s * 128)]
                } else if (t < 0.4) {
                    const s = (t - 0.2) / 0.2
                    return [Math.round(64 + s * (255 - 64)), 0, Math.round(128 * (1 - s))]
                } else if (t < 0.6) {
                    const s = (t - 0.4) / 0.2
                    return [255, Math.round(s * 165), 0]
                } else if (t < 0.8) {
                    const s = (t - 0.6) / 0.2
                    return [255, Math.round(165 + s * (255 - 165)), 0]
                } else {
                    const s = (t - 0.8) / 0.2
                    return [255, 255, Math.round(s * 255)]
                }

            case 'viridis':
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
                if (t < 0.5) {
                    const s = t / 0.5
                    return [
                        Math.round(100 + s * (255 - 100)),
                        Math.round(149 + s * (255 - 149)),
                        Math.round(237 + s * (255 - 237))
                    ]
                } else {
                    const s = (t - 0.5) / 0.5
                    return [
                        255,
                        Math.round(255 - s * (255 - 20)),
                        Math.round(255 - s * (255 - 60))
                    ]
                }
        }
    }

    // Create histogram data from vector
    const createHistogram = (vector: number[], numBins?: number) => {
        if (!vector || vector.length === 0) return { bins: [], stats: null }

        // Use fewer bins for mini views to make bars more visible
        const defaultBins = isMiniView ? 12 : 20
        const actualBins = numBins || defaultBins

        // Get value range
        let min = Math.min(...vector)
        let max = Math.max(...vector)

        // Use absolute scaling if specified
        if (scalingMode === 'absolute') {
            min = -1
            max = 1
        }

        // Handle edge case where all values are the same
        if (min === max) {
            return {
                bins: [{ start: min - 0.5, end: max + 0.5, count: vector.length, values: vector }],
                stats: { min, max, range: 1, total: vector.length }
            }
        }

        const range = max - min
        const binWidth = range / actualBins
        
        // Initialize bins
        const bins = Array.from({ length: actualBins }, (_, i) => ({
            start: min + i * binWidth,
            end: min + (i + 1) * binWidth,
            count: 0,
            values: [] as number[]
        }))

        // Fill bins with vector values
        vector.forEach(value => {
            // Clamp value to range
            const clampedValue = Math.max(min, Math.min(max, value))
            
            // Find appropriate bin (last bin includes max value)
            let binIndex = Math.floor((clampedValue - min) / binWidth)
            if (binIndex >= actualBins) binIndex = actualBins - 1
            if (binIndex < 0) binIndex = 0
            
            bins[binIndex].count++
            bins[binIndex].values.push(value)
        })

        return {
            bins,
            stats: { min, max, range, total: vector.length }
        }
    }

    // Monitor canvas ref availability
    useEffect(() => {
        if (canvasRef.current) {
            setIsCanvasReady(true)
        } else {
            setIsCanvasReady(false)
        }
    }, [])

    // Draw histogram
    useEffect(() => {
        if (!vector || !canvasRef.current || !isCanvasReady) {
            return
        }

        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Set canvas size
        canvas.width = size
        canvas.height = size

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // Create histogram data
        const { bins, stats } = createHistogram(vector)
        if (!stats || bins.length === 0) return

        // Set up drawing parameters based on view type
        let margin, chartWidth, chartHeight
        
        if (isMiniView) {
            // Minimal margins for mini view
            margin = { top: 4, right: 4, bottom: 4, left: 4 }
            chartWidth = size - margin.left - margin.right
            chartHeight = size - margin.top - margin.bottom
        } else {
            // Full margins for detailed view
            margin = { top: 20, right: 20, bottom: 40, left: 40 }
            chartWidth = size - margin.left - margin.right
            chartHeight = size - margin.top - margin.bottom
        }
        
        // Find max count for scaling
        const maxCount = Math.max(...bins.map(bin => bin.count), 1)

        // Draw histogram bars
        bins.forEach((bin, index) => {
            const barWidth = chartWidth / bins.length
            const barHeight = (bin.count / maxCount) * chartHeight
            const x = margin.left + index * barWidth
            const y = margin.top + chartHeight - barHeight

            // Color based on bin count (relative to max)
            const intensity = bin.count / maxCount
            const color = getColor(intensity)
            
            ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`
            
            // For mini views, remove gaps between bars for better visual continuity
            const gapSize = isMiniView ? 0 : 1
            ctx.fillRect(x, y, barWidth - gapSize, barHeight)

            // Add border only for larger views
            if (!isMiniView) {
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)'
                ctx.lineWidth = 0.5
                ctx.strokeRect(x, y, barWidth - 1, barHeight)
            }
        })

        // Only draw axes and labels for larger views
        if (!isMiniView) {
            // Draw axes
            ctx.strokeStyle = '#666'
            ctx.lineWidth = 1
            
            // Y-axis
            ctx.beginPath()
            ctx.moveTo(margin.left, margin.top)
            ctx.lineTo(margin.left, margin.top + chartHeight)
            ctx.stroke()
            
            // X-axis
            ctx.beginPath()
            ctx.moveTo(margin.left, margin.top + chartHeight)
            ctx.lineTo(margin.left + chartWidth, margin.top + chartHeight)
            ctx.stroke()

            // Add labels
            ctx.fillStyle = '#666'
            ctx.font = '10px sans-serif'
            ctx.textAlign = 'center'

            // X-axis labels (min, middle, max)
            const labelY = margin.top + chartHeight + 15
            ctx.fillText(stats.min.toFixed(2), margin.left, labelY)
            ctx.fillText(((stats.min + stats.max) / 2).toFixed(2), margin.left + chartWidth / 2, labelY)
            ctx.fillText(stats.max.toFixed(2), margin.left + chartWidth, labelY)

            // Y-axis label
            ctx.save()
            ctx.translate(15, margin.top + chartHeight / 2)
            ctx.rotate(-Math.PI / 2)
            ctx.textAlign = 'center'
            ctx.fillText('Count', 0, 0)
            ctx.restore()

            // X-axis title
            ctx.textAlign = 'center'
            ctx.fillText('Value', margin.left + chartWidth / 2, margin.top + chartHeight + 35)
        }

        // Add hover handler only for larger views with stats
        if (showStats && !isMiniView) {
            const handleMouseMove = (e: MouseEvent) => {
                const rect = canvas.getBoundingClientRect()
                const x = e.clientX - rect.left - margin.left
                const y = e.clientY - rect.top
                
                if (x < 0 || x > chartWidth || y < margin.top || y > margin.top + chartHeight) {
                    setHoveredBin(null)
                    return
                }
                
                const binIndex = Math.floor(x / (chartWidth / bins.length))
                if (binIndex >= 0 && binIndex < bins.length) {
                    const bin = bins[binIndex]
                    setHoveredBin({
                        index: binIndex,
                        count: bin.count,
                        range: `${bin.start.toFixed(3)} to ${bin.end.toFixed(3)}`
                    })
                } else {
                    setHoveredBin(null)
                }
            }

            const handleMouseLeave = () => {
                setHoveredBin(null)
            }

            canvas.addEventListener('mousemove', handleMouseMove)
            canvas.addEventListener('mouseleave', handleMouseLeave)

            return () => {
                canvas.removeEventListener('mousemove', handleMouseMove)
                canvas.removeEventListener('mouseleave', handleMouseLeave)
            }
        }
    }, [vector, isCanvasReady, size, scalingMode, colorScheme, showStats, isMiniView])

    // Render stats (only for larger views)
    const renderVectorStats = () => {
        if (!vector || vector.length === 0 || !showStats || isMiniView) return null

        const { stats } = createHistogram(vector)
        if (!stats) return null

        return (
            <div className="mt-2 text-xs text-gray-600">
                <div className="mb-1 p-1 bg-slate-50 rounded text-center">
                    <p><strong>Values:</strong> {stats.total} | <strong>Mode:</strong> {scalingMode}</p>
                    <p><strong>Range:</strong> {stats.min.toFixed(4)} to {stats.max.toFixed(4)}</p>
                </div>
                {hoveredBin && (
                    <div className="p-1 bg-slate-100 rounded text-center">
                        <p><strong>Bin {hoveredBin.index + 1}:</strong> {hoveredBin.count} values</p>
                        <p><strong>Range:</strong> {hoveredBin.range}</p>
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
import React, { useRef, useEffect, useState } from "react"

interface VectorRadialRendererProps {
    vector: number[] | null
    className?: string
    size?: number
    showStats?: boolean
    scalingMode?: 'relative' | 'absolute'
    colorScheme?: 'thermal' | 'viridis' | 'classic'
}

interface HoverInfo {
    dimension: number
    value: number
    x: number
    y: number
}

export default function VectorRadialRenderer({
    vector,
    className = "",
    size = 300,
    showStats = false,
    scalingMode = 'relative',
    colorScheme = 'thermal'
}: VectorRadialRendererProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null)
    const isMiniMode = size < 150 // Disable hover for mini displays

    // Color scheme functions
    const getColor = (value: number, min: number, max: number): string => {
        const normalizedValue = scalingMode === 'absolute' 
            ? (value + 1) / 2  // Convert -1 to 1 range to 0 to 1
            : (value - min) / (max - min)  // Relative scaling

        switch (colorScheme) {
            case 'thermal':
                if (normalizedValue < 0.25) {
                    const t = normalizedValue / 0.25
                    return `rgb(${Math.floor(64 * t)}, 0, ${Math.floor(128 + 127 * t)})`
                } else if (normalizedValue < 0.5) {
                    const t = (normalizedValue - 0.25) / 0.25
                    return `rgb(${Math.floor(64 + 191 * t)}, 0, 255)`
                } else if (normalizedValue < 0.75) {
                    const t = (normalizedValue - 0.5) / 0.25
                    return `rgb(255, ${Math.floor(165 * t)}, ${Math.floor(255 - 255 * t)})`
                } else {
                    const t = (normalizedValue - 0.75) / 0.25
                    return `rgb(255, ${Math.floor(165 + 90 * t)}, ${Math.floor(255 * t)})`
                }
            case 'viridis':
                const r = Math.floor(68 + (253 - 68) * normalizedValue)
                const g = Math.floor(1 + (231 - 1) * normalizedValue)
                const b = Math.floor(84 + (37 - 84) * normalizedValue)
                return `rgb(${r}, ${g}, ${b})`
            case 'classic':
                if (normalizedValue < 0.5) {
                    const t = normalizedValue / 0.5
                    return `rgb(${Math.floor(100 + 155 * t)}, ${Math.floor(149 + 106 * t)}, ${Math.floor(237 + 18 * t)})`
                } else {
                    const t = (normalizedValue - 0.5) / 0.5
                    return `rgb(${Math.floor(255 - 35 * t)}, ${Math.floor(255 - 235 * t)}, ${Math.floor(255 - 217 * t)})`
                }
            default:
                return '#666666'
        }
    }

    // Smart sampling helper for large vectors
    const getDisplayDimensions = (inputVector: number[]) => {
        const maxDisplayPoints = isMiniMode ? 24 : 72
        
        if (inputVector.length <= maxDisplayPoints) {
            return inputVector.map((value, index) => ({ value, index }))
        }
        
        const withIndices = inputVector.map((value, index) => ({ value, index, absValue: Math.abs(value) }))
        withIndices.sort((a, b) => b.absValue - a.absValue)
        
        const topCount = Math.floor(maxDisplayPoints * 0.4)
        const topDimensions = withIndices.slice(0, topCount)
        
        const remaining = withIndices.slice(topCount)
        const sampleCount = maxDisplayPoints - topCount
        const sampleStep = Math.floor(remaining.length / sampleCount)
        const sampledDimensions = []
        
        for (let i = 0; i < sampleCount && i * sampleStep < remaining.length; i++) {
            sampledDimensions.push(remaining[i * sampleStep])
        }
        
        const allDisplayed = [...topDimensions, ...sampledDimensions]
        allDisplayed.sort((a, b) => a.index - b.index)
        return allDisplayed
    }

    useEffect(() => {
        if (!vector || !canvasRef.current) return

        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Set canvas size with device pixel ratio for crisp rendering
        const devicePixelRatio = window.devicePixelRatio || 1
        canvas.width = size * devicePixelRatio
        canvas.height = size * devicePixelRatio
        canvas.style.width = `${size}px`
        canvas.style.height = `${size}px`
        ctx.scale(devicePixelRatio, devicePixelRatio)

        // Clear canvas
        ctx.clearRect(0, 0, size, size)

        const centerX = size / 2
        const centerY = size / 2
        const padding = Math.max(10, size * 0.05) // Proportional padding: 5% of size, minimum 10px
        const maxRadius = Math.min(size / 2 - padding, size / 2 - padding)

        // Calculate min/max for scaling
        const min = Math.min(...vector)
        const max = Math.max(...vector)
        const absMax = scalingMode === 'absolute' ? 1 : Math.max(Math.abs(min), Math.abs(max))

        const displayDimensions = getDisplayDimensions(vector)
        const totalDisplayCount = displayDimensions.length

        // Draw background circles (rings)
        ctx.strokeStyle = '#e5e7eb'
        ctx.lineWidth = 1
        for (let i = 1; i <= 4; i++) {
            ctx.beginPath()
            ctx.arc(centerX, centerY, (maxRadius * i) / 4, 0, 2 * Math.PI)
            ctx.stroke()
        }

        // Draw center point
        ctx.fillStyle = '#9ca3af'
        ctx.beginPath()
        ctx.arc(centerX, centerY, 2, 0, 2 * Math.PI)
        ctx.fill()

        // Draw vector dimensions as points around the circle
        displayDimensions.forEach(({ value, index }, displayIndex) => {
            const angle = (displayIndex / totalDisplayCount) * 2 * Math.PI - Math.PI / 2
            
            // Use same improved radial calculation as in drawing
            const normalizedAbs = Math.abs(value) / absMax
            const minRadius = maxRadius * 0.2
            const availableRadius = maxRadius - minRadius
            const scaledRadius = Math.sqrt(normalizedAbs) * availableRadius
            const radius = minRadius + scaledRadius
            
            const x = centerX + Math.cos(angle) * radius
            const y = centerY + Math.sin(angle) * radius

            // Draw point
            ctx.fillStyle = getColor(value, min, max)
            ctx.beginPath()
            ctx.arc(x, y, Math.max(2, size / 100), 0, 2 * Math.PI)
            ctx.fill()

            // Draw line from center to point (only if value is significant)
            if (Math.abs(value) > absMax * 0.1) { // Only draw lines for values > 10% of max
                ctx.strokeStyle = getColor(value, min, max)
                ctx.lineWidth = Math.max(1, size / 200)
                ctx.globalAlpha = 0.4
                ctx.beginPath()
                ctx.moveTo(centerX, centerY)
                ctx.lineTo(x, y)
                ctx.stroke()
                ctx.globalAlpha = 1
            }
        })

        // Draw dimension labels for larger sizes
        if (size > 200) {
            ctx.fillStyle = '#4b5563'
            ctx.font = `${Math.max(8, size / 30)}px sans-serif`
            ctx.textAlign = 'center'
            
            // Show every nth dimension label to avoid overcrowding
            const labelStep = Math.max(1, Math.floor(totalDisplayCount / 12))
            
            for (let i = 0; i < totalDisplayCount; i += labelStep) {
                const { index: originalIndex } = displayDimensions[i]
                const angle = (i / totalDisplayCount) * 2 * Math.PI - Math.PI / 2
                const labelRadius = maxRadius + Math.max(8, size * 0.03) // Proportional label spacing
                const x = centerX + Math.cos(angle) * labelRadius
                const y = centerY + Math.sin(angle) * labelRadius + 4
                
                ctx.fillText(originalIndex.toString(), x, y)
            }
        }

    }, [vector, size, scalingMode, colorScheme])

    // Handle mouse movement for hover effects
    const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (!vector || !canvasRef.current) return

        const rect = canvasRef.current.getBoundingClientRect()
        const mouseX = event.clientX - rect.left
        const mouseY = event.clientY - rect.top

        const centerX = size / 2
        const centerY = size / 2
        const padding = Math.max(10, size * 0.05)
        const maxRadius = Math.min(size / 2 - padding, size / 2 - padding)
        const absMax = scalingMode === 'absolute' ? 1 : Math.max(Math.abs(Math.min(...vector)), Math.abs(Math.max(...vector)))

        // Use the same sampling logic as rendering
        const displayDimensions = getDisplayDimensions(vector)
        const totalDisplayCount = displayDimensions.length

        // Find closest point among displayed dimensions
        let closestDimension = -1
        let closestDistance = Infinity
        let closestValue = 0

        displayDimensions.forEach(({ value, index }, displayIndex) => {
            const angle = (displayIndex / totalDisplayCount) * 2 * Math.PI - Math.PI / 2
            
            const normalizedAbs = Math.abs(value) / absMax
            const minRadius = maxRadius * 0.2
            const availableRadius = maxRadius - minRadius
            const scaledRadius = Math.sqrt(normalizedAbs) * availableRadius
            const radius = minRadius + scaledRadius
            
            const x = centerX + Math.cos(angle) * radius
            const y = centerY + Math.sin(angle) * radius

            const distance = Math.sqrt((mouseX - x) ** 2 + (mouseY - y) ** 2)
            if (distance < closestDistance && distance < 15) {
                closestDistance = distance
                closestDimension = index
                closestValue = value
            }
        })

        if (closestDimension >= 0) {
            // Find the display index for position calculation
            const displayIndex = displayDimensions.findIndex(d => d.index === closestDimension)
            const angle = (displayIndex / totalDisplayCount) * 2 * Math.PI - Math.PI / 2
            
            const normalizedAbs = Math.abs(closestValue) / absMax
            const minRadius = maxRadius * 0.2
            const availableRadius = maxRadius - minRadius
            const scaledRadius = Math.sqrt(normalizedAbs) * availableRadius
            const radius = minRadius + scaledRadius
            
            const x = centerX + Math.cos(angle) * radius
            const y = centerY + Math.sin(angle) * radius

            setHoverInfo({
                dimension: closestDimension,
                value: closestValue,
                x: x,
                y: y
            })
        } else {
            setHoverInfo(null)
        }
    }

    const handleMouseLeave = () => {
        setHoverInfo(null)
    }

    if (!vector || vector.length === 0) {
        return (
            <div className={`flex items-center justify-center bg-gray-100 rounded ${className}`} 
                 style={{ width: size, height: size }}>
                <p className="text-gray-500 text-sm">No vector data</p>
            </div>
        )
    }

    return (
        <div className={`relative ${className}`} style={{ width: size, height: size }}>
            <canvas
                ref={canvasRef}
                onMouseMove={isMiniMode ? undefined : handleMouseMove}
                onMouseLeave={isMiniMode ? undefined : handleMouseLeave}
                className={isMiniMode ? "" : "cursor-crosshair"}
                style={{ width: size, height: size }}
            />
            
            {/* Hover tooltip - only show in non-mini mode */}
            {!isMiniMode && hoverInfo && (
                <div 
                    className="absolute bg-black text-white text-xs p-2 rounded shadow-lg pointer-events-none z-10"
                    style={{
                        left: Math.min(hoverInfo.x + 10, size - 100),
                        top: Math.max(hoverInfo.y - 30, 10)
                    }}
                >
                    <div>Dim {hoverInfo.dimension}: {hoverInfo.value.toFixed(4)}</div>
                </div>
            )}
        </div>
    )
} 
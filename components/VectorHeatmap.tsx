import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import VectorHeatmapRenderer from "./VectorHeatmapRenderer"

interface VectorHeatmapProps {
    vector: number[] | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export default function VectorHeatmap({ 
    vector, 
    open, 
    onOpenChange 
}: VectorHeatmapProps) {
    const [forceRender, setForceRender] = useState(0)

    // Force redraw on dialog open
    useEffect(() => {
        if (open) {
            // Small delay to ensure DOM is ready
            const timer = setTimeout(() => {
                setForceRender(prev => prev + 1)
            }, 100)
            return () => clearTimeout(timer)
        }
    }, [open])

    // Download visualization as image
    const downloadVisualization = () => {
        const canvas = document.querySelector(".vector-heatmap canvas") as HTMLCanvasElement
        if (!canvas) return
        
        const link = document.createElement('a')
        link.download = 'vector-visualization.png'
        link.href = canvas.toDataURL('image/png')
        link.click()
    }

    // Render vector statistics
    const renderVectorStats = () => {
        if (!vector || vector.length === 0) return null

        const min = Math.min(...vector)
        const max = Math.max(...vector)
        const avg = vector.reduce((sum, val) => sum + val, 0) / vector.length
        const nonZeroCount = vector.filter(v => v !== 0).length
        const nonZeroPercent = ((nonZeroCount / vector.length) * 100).toFixed(1)

        return (
            <div className="mt-4 text-sm grid grid-cols-2 gap-x-8 gap-y-1">
                <p><strong>Dimensions:</strong> {vector.length}</p>
                <p><strong>Range:</strong> {min.toFixed(4)} to {max.toFixed(4)}</p>
                <p><strong>Average:</strong> {avg.toFixed(4)}</p>
                <p><strong>Non-zero values:</strong> {nonZeroCount} ({nonZeroPercent}%)</p>
            </div>
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader className="flex flex-row items-center justify-between">
                    <DialogTitle>Vector Visualization</DialogTitle>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-1"
                        onClick={downloadVisualization}
                    >
                        <Download className="h-4 w-4" />
                        <span>Download</span>
                    </Button>
                </DialogHeader>
                <div className="flex flex-col items-center">
                    <div 
                        className="vector-heatmap overflow-auto max-w-full border rounded p-2 flex justify-center items-center" 
                        style={{ 
                            minWidth: '300px', 
                            minHeight: '200px',
                            width: '100%',
                            backgroundColor: '#f9f9f9'
                        }}
                    >
                        <VectorHeatmapRenderer 
                            vector={vector}
                            showStats={true}
                        />
                    </div>
                    {renderVectorStats()}
                    <div className="flex justify-center mt-4 gap-6 p-2 bg-slate-50 rounded w-full">
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-blue-600 rounded-sm"></div>
                            <span>-1 (Negative)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-white border rounded-sm"></div>
                            <span>0 (Neutral)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-red-600 rounded-sm"></div>
                            <span>1 (Positive)</span>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        Hover over cells to see exact values. Brighter colors indicate stronger values.
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    )
} 
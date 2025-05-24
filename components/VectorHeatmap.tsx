import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, X } from "lucide-react"
import VectorVisualizationRenderer from "./VectorVisualizationRenderer"
import ColorSchemeSelector from "./ColorSchemeSelector"
import { useVectorSettings } from "@/hooks/useVectorSettings"

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
    const { settings, setColorScheme, setScalingMode, setVisualizationType } = useVectorSettings()

    // Force redraw on dialog open or settings change
    useEffect(() => {
        if (open) {
            // Small delay to ensure DOM is ready
            const timer = setTimeout(() => {
                setForceRender(prev => prev + 1)
            }, 100)
            return () => clearTimeout(timer)
        }
    }, [open, settings.colorScheme, settings.scalingMode, settings.visualizationType])

    // Download visualization as image
    const downloadVisualization = () => {
        const canvas = document.querySelector(".vector-visualization canvas") as HTMLCanvasElement
        if (!canvas) return
        
        const link = document.createElement('a')
        link.download = `vector-${settings.visualizationType}.png`
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

    // Render color legend based on current scheme (only for heatmap)
    const renderColorLegend = () => {
        if (settings.visualizationType !== 'heatmap') return null

        type LegendItem = { color: string; label: string; border?: boolean }
        
        const legends: Record<string, LegendItem[]> = {
            thermal: [
                { color: "#000000", label: "Lowest" },
                { color: "#400080", label: "Low" },
                { color: "#ff0000", label: "Medium" },
                { color: "#ffa500", label: "High" },
                { color: "#ffffff", label: "Highest", border: true }
            ],
            viridis: [
                { color: "#440154", label: "Lowest" },
                { color: "#31688e", label: "Low" },
                { color: "#35b779", label: "Medium" },
                { color: "#fde725", label: "Highest" }
            ],
            classic: [
                { color: "#6495ed", label: "Lowest" },
                { color: "#ffffff", label: "Medium", border: true },
                { color: "#dc1426", label: "Highest" }
            ]
        }

        const currentLegend = legends[settings.colorScheme]

        return (
            <div className="flex justify-center mt-4 gap-4 p-2 bg-slate-50 rounded w-full flex-wrap">
                {currentLegend.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <div 
                            className={`w-5 h-5 rounded-sm ${item.border ? 'border' : ''}`} 
                            style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm">{item.label}</span>
                    </div>
                ))}
            </div>
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader className="flex flex-row items-center justify-between">
                    <DialogTitle>Vector Visualization</DialogTitle>
                    <div className="flex gap-2">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="gap-1"
                            onClick={downloadVisualization}
                        >
                            <Download className="h-4 w-4" />
                            <span>Download</span>
                        </Button>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => onOpenChange(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </DialogHeader>

                {/* Always Visible Settings Panel */}
                <div className="border rounded-lg p-4 bg-gray-50">
                    <h3 className="font-medium mb-3">Visualization Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Visualization Type:</label>
                            <select 
                                value={settings.visualizationType} 
                                onChange={(e) => setVisualizationType(e.target.value as any)}
                                className="border rounded px-2 py-1 w-full"
                            >
                                <option value="heatmap">Heatmap Grid</option>
                                <option value="distribution">Distribution Graph</option>
                            </select>
                        </div>
                        <ColorSchemeSelector
                            value={settings.colorScheme}
                            onChange={setColorScheme}
                            showPreview={false}
                        />
                        <div>
                            <label className="block text-sm font-medium mb-1">Scaling Mode:</label>
                            <select 
                                value={settings.scalingMode} 
                                onChange={(e) => setScalingMode(e.target.value as any)}
                                className="border rounded px-2 py-1 w-full"
                            >
                                <option value="relative">Relative (min/max)</option>
                                <option value="absolute">Absolute (-1 to 1)</option>
                            </select>
                        </div>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                        Settings are automatically saved and will be used for all vector visualizations.
                    </p>
                </div>

                <div className="flex flex-col items-center">
                    <div 
                        className="vector-visualization w-full h-full flex justify-center items-center" 
                        style={{ 
                            minWidth: '300px', 
                            minHeight: '200px'
                        }}
                        key={`${settings.colorScheme}-${settings.scalingMode}-${settings.visualizationType}-${forceRender}`}
                    >
                        <VectorVisualizationRenderer 
                            vector={vector}
                            showStats={true}
                            colorScheme={settings.colorScheme}
                            scalingMode={settings.scalingMode}
                            visualizationType={settings.visualizationType}
                        />
                    </div>
                    {renderVectorStats()}
                    {renderColorLegend()}
                    <p className="text-xs text-muted-foreground mt-2">
                        {settings.visualizationType === 'heatmap' 
                            ? "Hover over cells to see exact values. Colors represent relative intensity."
                            : "Hover over bars to see bin details. Bar heights show value frequency distribution."
                        }
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    )
} 
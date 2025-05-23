import { useState } from "react"
import VectorHeatmapRenderer from "./VectorHeatmapRenderer"
import VectorHeatmap from "./VectorHeatmap"
import { BarChart2 } from "lucide-react"

interface MiniVectorHeatmapProps {
    vector: number[] | null
    disabled?: boolean
}

export default function MiniVectorHeatmap({ vector, disabled = false }: MiniVectorHeatmapProps) {
    const [showHeatmap, setShowHeatmap] = useState(false)
        
    // Check if we have a valid vector to display
    const hasValidVector = vector && vector.length > 0 && vector.every(val => 
        typeof val === 'number' && !isNaN(val) && isFinite(val)
    )
    
    // Skip rendering if disabled or no valid vector
    if (disabled || !hasValidVector) {
        return null
    } 
    
    return (
        <>
            <div 
                className="mini-vector-heatmap cursor-pointer flex w-20 h-20 items-center justify-center rounded bg-gray-50 hover:bg-gray-100 transition-colors"
                onClick={() => setShowHeatmap(true)}
                title="View vector visualization"
            >
                <div className="relative h-full overflow-hidden flex items-center justify-center">
                    <VectorHeatmapRenderer 
                        vector={vector}
                        showStats={false}
                        size={80}
                        // Let the renderer calculate optimal cell size based on the fixed size
                    />
                </div>
            </div>
            
            <VectorHeatmap 
                vector={vector}
                open={showHeatmap}
                onOpenChange={setShowHeatmap}
            />
        </>
    )
} 
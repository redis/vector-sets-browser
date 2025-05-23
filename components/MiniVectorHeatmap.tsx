import { useState } from "react"
import VectorHeatmapRenderer from "./VectorHeatmapRenderer"
import VectorHeatmap from "./VectorHeatmap"
import { BarChart2 } from "lucide-react"

interface MiniVectorHeatmapProps {
    vector: number[] | null
    disabled?: boolean
    isGeneratingEmbedding?: boolean
}

export default function MiniVectorHeatmap({ 
    vector, 
    disabled = false, 
    isGeneratingEmbedding = false 
}: MiniVectorHeatmapProps) {
    const [showHeatmap, setShowHeatmap] = useState(false)
        
    // Check if we have a valid vector to display
    const hasValidVector = vector && vector.length > 0 && vector.every(val => 
        typeof val === 'number' && !isNaN(val) && isFinite(val)
    )
    
    // Skip rendering if disabled
    if (disabled) {
        return null
    }
    
    // Show loading spinner when generating embedding
    if (isGeneratingEmbedding) {
        return (
            <div 
                className="mini-vector-heatmap flex w-20 h-20 items-center justify-center rounded bg-gray-50"
                title="Generating embedding..."
            >
                <svg
                    className="animate-spin h-6 w-6 text-gray-400"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                    ></circle>
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                </svg>
            </div>
        )
    }
    
    // Don't show anything if no valid vector
    if (!hasValidVector) {
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
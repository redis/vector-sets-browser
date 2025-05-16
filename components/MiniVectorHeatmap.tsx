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
    
    // Add detailed debug logging
    console.log("MiniVectorHeatmap received vector:", {
        isNull: vector === null,
        isArray: Array.isArray(vector),
        length: vector?.length,
        firstFewValues: vector?.slice(0, 5),
        hasNaN: vector?.some(v => isNaN(v) || !isFinite(v))
    });
    
    // Check if we have a valid vector to display
    const hasValidVector = vector && vector.length > 0 && vector.every(val => 
        typeof val === 'number' && !isNaN(val) && isFinite(val)
    )
    
    // Skip rendering if disabled or no valid vector
    if (disabled || !hasValidVector) {
        console.log("No valid vector to display", {
            disabled,
            hasValidVector,
            vectorLength: vector?.length
        })
        return null
    } else {
        console.log("Valid vector to display", vector?.length)
    }
    
    return (
        <>
            <div 
                className="mini-vector-heatmap cursor-pointer flex w-20 h-20 items-center justify-center p-1 rounded bg-gray-50 hover:bg-gray-100 transition-colors"
                onClick={() => setShowHeatmap(true)}
                title="View vector visualization"
            >
                <div className="relative h-full border rounded overflow-hidden bg-white flex items-center justify-center">
                    <VectorHeatmapRenderer 
                        vector={vector}
                        showStats={false}
                        width={80}
                        height={80}
                        cellSize={2}
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
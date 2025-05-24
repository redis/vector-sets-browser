import { useState } from "react"
import VectorVisualizationRenderer from "./VectorVisualizationRenderer"
import ColorSchemeSelector from "./ColorSchemeSelector"

export default function VectorHeatmapDemo() {
    // Generate some test vectors with different characteristics
    const generateVector = (type: 'clustered' | 'wide' | 'normal') => {
        const length = 256
        const values = []
        
        for (let i = 0; i < length; i++) {
            switch (type) {
                case 'clustered':
                    // Values clustered around 0 (your original problem case)
                    values.push((Math.random() - 0.5) * 0.2)
                    break
                case 'wide':
                    // Values spread across wide range
                    values.push((Math.random() - 0.5) * 10)
                    break
                case 'normal':
                    // Normal distribution-like values
                    values.push(Math.random() * 2 - 1)
                    break
            }
        }
        return values
    }

    const [vectorType, setVectorType] = useState<'clustered' | 'wide' | 'normal'>('clustered')
    const [scalingMode, setScalingMode] = useState<'relative' | 'absolute'>('relative')
    const [colorScheme, setColorScheme] = useState<'thermal' | 'viridis' | 'classic'>('thermal')
    const [visualizationType, setVisualizationType] = useState<'heatmap' | 'distribution'>('heatmap')
    
    const vector = generateVector(vectorType)

    return (
        <div className="p-6 space-y-6">
            <h2 className="text-2xl font-bold">Vector Visualization Demo</h2>
            
            {/* Controls */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Vector Type:</label>
                    <select 
                        value={vectorType} 
                        onChange={(e) => setVectorType(e.target.value as any)}
                        className="border rounded px-2 py-1 w-full"
                    >
                        <option value="clustered">Clustered around 0</option>
                        <option value="wide">Wide range</option>
                        <option value="normal">Normal range</option>
                    </select>
                </div>
                
                <div>
                    <label className="block text-sm font-medium mb-1">Visualization Type:</label>
                    <select 
                        value={visualizationType} 
                        onChange={(e) => setVisualizationType(e.target.value as any)}
                        className="border rounded px-2 py-1 w-full"
                    >
                        <option value="heatmap">Heatmap Grid</option>
                        <option value="distribution">Distribution Graph</option>
                    </select>
                </div>
                
                <div>
                    <label className="block text-sm font-medium mb-1">Scaling Mode:</label>
                    <select 
                        value={scalingMode} 
                        onChange={(e) => setScalingMode(e.target.value as any)}
                        className="border rounded px-2 py-1 w-full"
                    >
                        <option value="relative">Relative (min/max)</option>
                        <option value="absolute">Absolute (-1 to 1)</option>
                    </select>
                </div>
                
                <ColorSchemeSelector
                    value={colorScheme}
                    onChange={setColorScheme}
                    showPreview={true}
                />
            </div>

            {/* Visualization */}
            <div className="flex flex-col items-center">
                <VectorVisualizationRenderer
                    vector={vector}
                    size={400}
                    showStats={true}
                    scalingMode={scalingMode}
                    colorScheme={colorScheme}
                    visualizationType={visualizationType}
                    className="border rounded shadow"
                />
                
                <div className="mt-4 text-sm text-gray-600 max-w-md text-center">
                    <p>
                        <strong>Tip:</strong> Try different vector types and visualization modes to see how they represent the data. 
                        Distribution graphs show value frequency, while heatmaps show spatial patterns.
                    </p>
                </div>
            </div>
        </div>
    )
} 
import { useState } from "react"
import MiniVectorHeatmap from "./MiniVectorHeatmap"
import { useVectorSettings } from "@/hooks/useVectorSettings"

export default function VectorVisualizationExample() {
    // Generate a sample vector
    const sampleVector = Array.from({ length: 256 }, (_, i) => 
        Math.sin(i * 0.1) * Math.cos(i * 0.05) + Math.random() * 0.2 - 0.1
    )
    
    const { settings } = useVectorSettings()
    
    return (
        <div className="p-6 space-y-4">
            <h3 className="text-lg font-semibold">Settings Persistence Demo</h3>
            <p className="text-sm text-gray-600">
                Change the color scheme or scaling mode in the popup dialog. 
                The mini heatmap will automatically use your saved preferences.
            </p>
            
            <div className="flex items-center gap-4">
                <MiniVectorHeatmap 
                    vector={sampleVector}
                    disabled={false}
                    isGeneratingEmbedding={false}
                />
                <div className="text-sm">
                    <p><strong>Current Settings:</strong></p>
                    <p>Color Scheme: {settings.colorScheme}</p>
                    <p>Scaling Mode: {settings.scalingMode}</p>
                </div>
            </div>
            
            <p className="text-xs text-gray-500">
                Click the mini heatmap to open the full dialog and change settings. 
                Settings are saved automatically and persist across browser sessions.
            </p>
        </div>
    )
} 
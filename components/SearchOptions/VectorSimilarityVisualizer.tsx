import { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { cosineSimilarity, parseVectorString } from '@/lib/vector/vectorUtils';
import { Expand, Minimize2, Plus, Minus, Equal } from 'lucide-react';
import MiniVectorHeatmap from '../MiniVectorHeatmap';

interface VectorInput {
    id: string;
    vector: string;
    weight: number;
}

interface VectorSimilarityVisualizerProps {
    inputs: VectorInput[];
    combinedVector?: number[] | null;
}

export default function VectorSimilarityVisualizer({ inputs, combinedVector }: VectorSimilarityVisualizerProps) {
    const [expanded, setExpanded] = useState(false);
    
    // Only include inputs that have valid vectors
    const validInputs = useMemo(() => {
        return inputs.filter(input => {
            const vec = parseVectorString(input.vector);
            return vec.length > 5 && !vec.some(isNaN);
        });
    }, [inputs]);
    
    // Skip rendering if we don't have at least 2 valid vectors
    if (validInputs.length < 2) {
        return null;
    }
    
    // Calculate similarity matrix
    const similarityMatrix = validInputs.map((input1, i) => {
        const vec1 = parseVectorString(input1.vector);
        
        return validInputs.map((input2, j) => {
            // For the diagonal, just return 1 (self-similarity)
            if (i === j) return 1;
            
            const vec2 = parseVectorString(input2.vector);
            
            // Both vectors must have the same dimension
            if (vec1.length !== vec2.length) return null;
            
            try {
                return cosineSimilarity(vec1, vec2);
            } catch (error) {
                console.error("Error calculating similarity:", error);
                return null;
            }
        });
    });
    
    // Helper function to get a color for a similarity value
    const getSimilarityColor = (sim: number | null) => {
        if (sim === null) return 'bg-gray-200';
        
        // Convert similarity to a color scale (blue to red)
        // 1.0 (identical) = deep blue
        // 0.0 (orthogonal) = white
        // -1.0 (opposite) = red
        
        if (sim > 0) {
            // Blue scale for positive similarity
            const intensity = Math.round(sim * 255);
            return `rgb(0, 0, ${intensity})`;
        } else {
            // Red scale for negative similarity
            const intensity = Math.round(Math.abs(sim) * 255);
            return `rgb(${intensity}, 0, 0)`;
        }
    };
    
    // Format similarity for display
    const formatSimilarity = (sim: number | null) => {
        if (sim === null) return 'N/A';
        return sim.toFixed(3);
    };
    
    if (!expanded) {
        // Compact view - just show a button to expand
        return (
            <div className="mt-2 mb-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="text-xs w-full justify-between"
                    onClick={() => setExpanded(true)}
                >
                    <span>Show Vector Similarities ({validInputs.length} valid vectors)</span>
                    <Expand size={16} />
                </Button>
            </div>
        );
    }
    
    return (
        <div className="mt-2 mb-4 border p-3 rounded-md bg-white">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold">Vector Similarities</h3>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpanded(false)}
                >
                    <Minimize2 size={16} />
                </Button>
            </div>
            
            <div className="text-xs text-gray-500 mb-2">
                This matrix shows cosine similarity between your input vectors. 
                Values close to 1.0 indicate vectors pointing in the same direction, 
                0.0 means orthogonal vectors, and -1.0 means opposite directions.
            </div>
            
            {/* Combined Vector Visualization - Visual Equation */}
            {combinedVector && validInputs.length > 0 && (
                <div className="mb-4 p-3 bg-gray-50 rounded-md">
                    <h4 className="text-sm font-medium mb-3">Combined Vector Visualization</h4>
                    
                    {/* Visual equation showing X + Y = Z */}
                    <div className="flex items-center justify-center gap-4 mb-3">
                        <div className="flex flex-wrap items-center gap-3">
                            {validInputs.map((input, index) => {
                                const vector = parseVectorString(input.vector);
                                const isPositive = input.weight >= 0;
                                
                                return (
                                    <div key={input.id} className="flex items-center gap-2">
                                        {index > 0 && (
                                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white border text-xs">
                                                {isPositive ? <Plus size={12} /> : <Minus size={12} />}
                                            </div>
                                        )}
                                        
                                        <div className="flex flex-col items-center gap-1">
                                            <MiniVectorHeatmap vector={vector} />
                                            <div className="text-xs text-gray-600">
                                                Vector {index + 1}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                weight: {input.weight.toFixed(1)}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {/* Equals sign */}
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 border text-xs">
                                <Equal size={12} />
                            </div>
                            
                            {/* Combined result */}
                            <div className="flex flex-col items-center gap-1">
                                <MiniVectorHeatmap vector={combinedVector} />
                                <div className="text-xs text-gray-600 font-medium">
                                    Combined
                                </div>
                                <div className="text-xs text-gray-500">
                                    dim: {combinedVector.length}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="text-xs text-gray-500 text-center">
                        Click any heatmap to view detailed vector visualization
                    </div>
                </div>
            )}
            
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                    <thead>
                        <tr>
                            <th className="p-1 border bg-gray-100"></th>
                            {validInputs.map((input, i) => (
                                <th key={input.id} className="p-1 border bg-gray-100">
                                    Vector {i+1}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {similarityMatrix.map((row, i) => (
                            <tr key={i}>
                                <th className="p-1 border bg-gray-100">Vector {i+1}</th>
                                {row.map((sim, j) => (
                                    <td 
                                        key={j} 
                                        className="p-2 border text-center"
                                        style={{ 
                                            backgroundColor: i === j ? '#f0f0f0' : 'white',
                                            color: i === j ? '#666' : 'black'
                                        }}
                                    >
                                        <div 
                                            className="w-full h-6 flex items-center justify-center rounded"
                                            style={{ 
                                                backgroundColor: i !== j ? getSimilarityColor(sim) : 'transparent',
                                                color: i !== j ? 'white' : 'inherit'
                                            }}
                                        >
                                            {formatSimilarity(sim)}
                                        </div>
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <div className="text-xs text-gray-400 mt-2">
                Higher similarity between vectors means they'll reinforce each other in the combined result.
                Dissimilar vectors help explore different semantic directions.
            </div>
        </div>
    );
} 
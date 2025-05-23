import { VectorCombinationMethod } from "@/lib/vector/vectorUtils"

export interface VectorInput {
    id: string
    vector: string
    weight: number
    imageData?: string
    embedding?: number[] // Store generated embedding for visualization
}

// Combination method options with descriptions
export const combinationMethodOptions = [
    { 
        value: VectorCombinationMethod.LINEAR, 
        label: "Linear Combination",
        description: "Standard weighted sum of vectors (w₁·V₁ + w₂·V₂ + ...)",
    },
    { 
        value: VectorCombinationMethod.POWER_WEIGHTED, 
        label: "Power Weighted",
        description:
            "Weights are raised to a power to emphasize higher weights",
    },
    { 
        value: VectorCombinationMethod.WEIGHTED_AVERAGE, 
        label: "Weighted Average",
        description:
            "Weighted sum divided by sum of weights, keeps magnitude similar to input",
    },
    { 
        value: VectorCombinationMethod.ORTHOGONALIZE, 
        label: "Orthogonalize",
        description:
            "Makes vectors orthogonal before combining to capture unique directions",
    },
    { 
        value: VectorCombinationMethod.COMPONENT_MAX, 
        label: "Component-wise Max",
        description:
            "Takes maximum value at each dimension across weighted vectors",
    },
]

// Generate a random ID for new vector inputs
export const generateId = () => Math.random().toString(36).substring(2, 9)

// Color utilities for visualization
export const colorClasses = [
    "bg-blue-400",
    "bg-green-400",
    "bg-yellow-400",
    "bg-red-400",
    "bg-purple-400",
    "bg-pink-400",
]

export const colorMap: Record<string, { light: string; dark: string }> = {
    "bg-blue-400": { light: "#60a5fa", dark: "#3b82f6" },
    "bg-green-400": { light: "#4ade80", dark: "#22c55e" },
    "bg-yellow-400": { light: "#facc15", dark: "#eab308" },
    "bg-red-400": { light: "#f87171", dark: "#ef4444" },
    "bg-purple-400": { light: "#c084fc", dark: "#a855f7" },
    "bg-pink-400": { light: "#f472b6", dark: "#ec4899" },
}

// Get description for a combination method
export const getMethodDescription = (combinationMethod: VectorCombinationMethod): string => {
    const selectedMethod = combinationMethodOptions.find(
        (option) => option.value === combinationMethod
    )
    return selectedMethod?.description || ""
} 
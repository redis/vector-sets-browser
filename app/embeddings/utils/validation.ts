import { EmbeddingProvider, getModelData } from "../types/config"

export interface ValidationResult {
    isValid: boolean
    error?: string
    vector: number[]
    debug?: {
        originalType: string
        isArray: boolean
        originalLength?: number
        containsNonNumbers?: boolean
        sampleValues?: any[]
    }
}

export function validateAndNormalizeVector(
    vector: unknown,
    provider: EmbeddingProvider,
    expectedDimensions?: number
): ValidationResult {
    // Debug information
    const debug = {
        originalType: typeof vector,
        isArray: Array.isArray(vector),
        originalLength: Array.isArray(vector) ? vector.length : undefined,
        containsNonNumbers: undefined as boolean | undefined,
        sampleValues: undefined as any[] | undefined,
    }

    // Check if vector is an array
    if (!Array.isArray(vector)) {
        return {
            isValid: false,
            error: "Vector is not an array",
            vector: [],
            debug
        }
    }

    // Handle different vector formats based on provider
    let normalizedVector: number[] = [];
    
    try {
        // Process vector based on provider
        if (Array.isArray(vector)) {
            // If it's already an array, check if it's nested
            if (vector.length > 0 && Array.isArray(vector[0])) {
                // It's a nested array, take the first element
                normalizedVector = vector[0].map(Number)
                debug.sampleValues = vector[0].slice(0, 5)
            } else {
                // It's a flat array
                normalizedVector = vector.map(Number)
                debug.sampleValues = vector.slice(0, 5)
            }
        } else {
            throw new Error(`Invalid vector format: ${typeof vector}`)
        }

        // Check if vector has any values
        if (normalizedVector.length === 0) {
            return {
                isValid: false,
                error: "Vector is empty",
                vector: [],
                debug
            }
        }

        // Check for non-numeric values
        debug.containsNonNumbers = normalizedVector.some(
            (v) => typeof v !== "number" || isNaN(v)
        )

        if (debug.containsNonNumbers) {
            return {
                isValid: false,
                error: "Vector contains non-numeric values",
                vector: [],
                debug
            }
        }

        // Check if vector contains all zeros
        if (normalizedVector.every((v) => v === 0)) {
            return {
                isValid: false,
                error: "Vector contains all zeros",
                vector: [],
                debug
            }
        }

        // Validate dimensions if expected dimensions are provided
        if (
            expectedDimensions !== undefined &&
            normalizedVector.length !== expectedDimensions
        ) {
            return {
                vector: normalizedVector,
                isValid: false,
                error: `Vector dimensions (${normalizedVector.length}) do not match expected dimensions (${expectedDimensions})`,
                debug,
            }
        }

        // Normalize the vector
        const magnitude = Math.sqrt(normalizedVector.reduce((sum, v) => sum + v * v, 0))
        const normalizedResult = normalizedVector.map((v) => v / magnitude)

        return {
            isValid: true,
            vector: normalizedResult,
            debug
        }
    } catch (error) {
        return {
            vector: [],
            isValid: false,
            error: error instanceof Error ? error.message : String(error),
            debug,
        }
    }
}

/**
 * Compares two vectors to check if they have the same format
 */
export function compareVectorFormats(
    vector1: number[],
    vector2: number[]
): {
    isSameFormat: boolean
    details: {
        dimensionsMatch: boolean
        vector1Length: number
        vector2Length: number
        vector1Sample: number[]
        vector2Sample: number[]
        vector1ValueRange: { min: number; max: number }
        vector2ValueRange: { min: number; max: number }
    }
} {
    // Get min and max values for each vector
    const vector1Min = Math.min(...vector1)
    const vector1Max = Math.max(...vector1)
    const vector2Min = Math.min(...vector2)
    const vector2Max = Math.max(...vector2)

    const dimensionsMatch = vector1.length === vector2.length

    return {
        isSameFormat: dimensionsMatch,
        details: {
            dimensionsMatch,
            vector1Length: vector1.length,
            vector2Length: vector2.length,
            vector1Sample: vector1.slice(0, 5),
            vector2Sample: vector2.slice(0, 5),
            vector1ValueRange: { min: vector1Min, max: vector1Max },
            vector2ValueRange: { min: vector2Min, max: vector2Max },
        },
    }
} 
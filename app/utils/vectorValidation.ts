/**
 * Utility functions for validating and normalizing vector data from different embedding engines
 */

/**
 * Validates and normalizes a vector to ensure it's in the correct format
 * @param vector The vector to validate and normalize
 * @param source The source of the vector (e.g., 'tensorflow', 'ollama')
 * @param expectedDimensions Optional expected dimensions for validation
 * @returns Normalized vector as number[]
 */
export function validateAndNormalizeVector(
    vector: any,
    source: "tensorflow" | "ollama" | "unknown",
    expectedDimensions?: number
): {
    vector: number[]
    isValid: boolean
    error?: string
    debug: {
        originalType: string
        isArray: boolean
        originalLength?: number
        containsNonNumbers?: boolean
        sampleValues?: any[]
    }
} {
    // TODO DEBUG - return what we passed in
    return {
        vector: vector,
        isValid: true,
        error: undefined,
        debug: {
            originalType: typeof vector,
            isArray: Array.isArray(vector),
            originalLength: Array.isArray(vector) ? vector.length : undefined,
            containsNonNumbers: undefined,
            sampleValues: undefined,
        },
    }
    // Debug information
    const debug = {
        originalType: typeof vector,
        isArray: Array.isArray(vector),
        originalLength: Array.isArray(vector) ? vector.length : undefined,
        containsNonNumbers: undefined,
        sampleValues: undefined,
    }

    // Handle different vector formats based on source
    let normalizedVector: number[] = []

    try {
        // Handle TensorFlow.js specific format
        if (source === "tensorflow") {
            // TensorFlow.js might return nested arrays or tensor objects
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
            } else if (typeof vector === "object" && vector !== null) {
                // It might be a TensorFlow.js tensor or other object
                // Try to convert to array if possible
                if (typeof vector.arraySync === "function") {
                    const arrayData = vector.arraySync()
                    normalizedVector = Array.isArray(arrayData[0])
                        ? arrayData[0].map(Number)
                        : arrayData.map(Number)
                    debug.sampleValues = normalizedVector.slice(0, 5)
                } else {
                    throw new Error("Unsupported TensorFlow.js vector format")
                }
            } else {
                throw new Error(
                    `Invalid TensorFlow.js vector format: ${typeof vector}`
                )
            }
        }
        // Handle Ollama specific format
        else if (source === "ollama") {
            // Ollama typically returns a flat array
            if (Array.isArray(vector)) {
                normalizedVector = vector.map(Number)
                debug.sampleValues = vector.slice(0, 5)
            } else {
                throw new Error(
                    `Invalid Ollama vector format: ${typeof vector}`
                )
            }
        }
        // Generic handling for unknown sources
        else {
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
        }

        // Check for non-numeric values
        debug.containsNonNumbers = normalizedVector.some(
            (v) => typeof v !== "number" || isNaN(v)
        )

        // Validate the normalized vector
        if (!Array.isArray(normalizedVector)) {
            return {
                vector: [],
                isValid: false,
                error: "Normalized vector is not an array",
                debug,
            }
        }

        if (normalizedVector.some((v) => typeof v !== "number" || isNaN(v))) {
            return {
                vector: [],
                isValid: false,
                error: "Vector contains non-numeric values",
                debug,
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

        return {
            vector: normalizedVector,
            isValid: true,
            debug,
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
 * @param vector1 First vector to compare
 * @param vector2 Second vector to compare
 * @returns Comparison result with details
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

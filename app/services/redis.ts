// Helper to get the base URL depending on client/server context
const getBaseUrl = () => {
    if (typeof window === "undefined") {
        // Server-side: use environment variable or default
        return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
    }
    // Client-side: use relative URL
    return ""
}

interface RedisApiParams {
    keyName?: string
    vector?: number[]
    element?: string
    searchVector?: number[]
    searchElement?: string
    count?: number
    metadata?: Record<string, unknown>
    dimensions?: number
    url?: string
}

async function callRedisApi(action: string, params: RedisApiParams) {
    try {
        const baseUrl = getBaseUrl()
        const response = await fetch(`${baseUrl}/api/redis`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ action, params }),
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(
                `HTTP error! status: ${response.status}, message: ${errorText}`
            )
        }

        const data = await response.json()
        if (!data.success) {
            throw new Error(data.error || `Redis operation ${action} failed`)
        }
        return data // Return the entire response since it's no longer double-wrapped
    } catch (error) {
        console.error(`Error in Redis API call (${action}):`, error)
        throw error
    }
}

export async function connect(url: string): Promise<void> {
    try {
        const baseUrl = getBaseUrl()
        const response = await fetch(`${baseUrl}/api/redis/connect`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ url }),
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(
                `HTTP error! status: ${response.status}, message: ${errorText}`
            )
        }

        const data = await response.json()
        if (!data.success) {
            throw new Error(data.error || "Failed to connect to Redis")
        }
    } catch (error) {
        console.error("Error connecting to Redis:", error)
        throw error
    }
}

export async function disconnect(): Promise<void> {
    try {
        const baseUrl = getBaseUrl()
        const response = await fetch(`${baseUrl}/api/redis/connect`, {
            method: "DELETE",
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(
                `HTTP error! status: ${response.status}, message: ${errorText}`
            )
        }

        const data = await response.json()
        if (!data.success) {
            throw new Error(data.error || "Failed to disconnect from Redis")
        }
    } catch (error) {
        console.error("Error disconnecting from Redis:", error)
        throw error
    }
}

import { validateAndNormalizeVector } from "../utils/vectorValidation"

export async function vadd(
    keyName: string,
    element: string,
    vector: number[]
): Promise<any> {
    if (!keyName) {
        throw new Error("keyName is required for VADD operation")
    }
    if (!element) {
        throw new Error("element is required for VADD operation")
    }
    if (!vector || !Array.isArray(vector)) {
        throw new Error("vector must be an array for VADD operation")
    }

    try {
        // Validate and normalize the vector
        const validationResult = validateAndNormalizeVector(vector, "unknown")
        if (!validationResult.isValid) {
            console.error("Vector validation failed:", validationResult)
            throw new Error(`Invalid vector data: ${validationResult.error}`)
        }

        // Use the normalized vector
        const normalizedVector = validationResult.vector

        // Log validation details for debugging
        console.log("VADD - Vector validation result:", {
            isValid: validationResult.isValid,
            debug: validationResult.debug,
        })

        const response = await callRedisApi("vadd", {
            keyName,
            element,
            vector: normalizedVector,
        })

        if (!response?.success) {
            throw new Error(
                `VADD operation failed: ${response?.error || "Unknown error"}`
            )
        }

        return response.result
    } catch (error) {
        console.error("VADD operation error:", error)
        throw error
    }
}

export async function vsim(
    keyName: string,
    searchInput: number[] | string,
    count: number
): Promise<[string, number][]> {
    // Construct params based on searchInput type
    const params = {
        keyName,
        count,
        ...(Array.isArray(searchInput)
            ? { vector: searchInput }
            : { searchElement: searchInput }),
    }

    const response = await callRedisApi("vsim", params)

    // Handle the response
    if (!response?.success) {
        console.error("VSIM operation failed:", response?.error)
        return []
    }

    if (!Array.isArray(response.result)) {
        console.error("VSIM results not in expected format:", response.result)
        return []
    }

    // Filter out any results with invalid IDs
    const validResults = response.result.filter((result: any) => {
        if (!Array.isArray(result) || result.length !== 2) {
            console.warn("Invalid result format:", result)
            return false
        }
        const [id, score] = result
        if (!id || typeof id !== "string") {
            console.warn("Invalid ID in result:", id)
            return false
        }
        if (typeof score !== "number" && typeof score !== "string") {
            console.warn("Invalid score in result:", score)
            return false
        }
        return true
    })

    // Return just the IDs and scores without fetching vectors
    return validResults.map(([id, score]) => [id, Number(score)])
}

export async function vdim(keyName: string): Promise<number> {
    const response = await callRedisApi("vdim", { keyName })
    if (!response?.success || typeof response.result !== "number") {
        throw new Error("Failed to get vector dimensions")
    }
    return response.result
}

export async function vcard(keyName: string): Promise<number> {
    const response = await callRedisApi("vcard", { keyName })
    if (!response?.success || typeof response.result !== "number") {
        throw new Error("Failed to get vector count")
    }
    return response.result
}

export async function vrem(keyName: string, element: string): Promise<number> {
    const response = await callRedisApi("vrem", { keyName, element })
    if (!response?.success) {
        throw new Error("Failed to remove vector")
    }
    return response.result
}

export async function vemb(
    keyName: string,
    element: string
): Promise<number[]> {
    if (!keyName) {
        throw new Error("keyName is required for VEMB operation")
    }
    if (!element) {
        throw new Error("element is required for VEMB operation")
    }

    try {
        const response = await callRedisApi("vemb", {
            keyName,
            element,
        })

        if (!response?.success) {
            throw new Error(
                `VEMB operation failed: ${response?.error || "Unknown error"}`
            )
        }

        // The vector is directly in the result
        const vector = response.result
        if (!Array.isArray(vector)) {
            throw new Error(`Invalid vector format for element ${element}`)
        }

        return vector.map((v) => {
            const num = Number(v)
            return isNaN(num) ? 0 : num
        })
    } catch (error) {
        console.error("VEMB operation error:", error)
        throw error
    }
}

export async function getVectorWithSimilarity(
    keyName: string,
    id: string,
    similarity: number
): Promise<[string, number, number[]]> {
    try {
        const vector = await vemb(keyName, id)
        return [id, similarity, vector]
    } catch (error) {
        console.error(`Failed to fetch vector for ${id}:`, error)
        throw error
    }
}

export async function getRedisInfo(): Promise<Record<string, any>> {
    const response = await callRedisApi("getRedisInfo", {})
    if (!response?.success) {
        throw new Error("Failed to get Redis info")
    }
    return response.result
}

export async function getMemoryUsage(keyName: string): Promise<number> {
    const response = await callRedisApi("memoryUsage", { keyName })
    if (!response?.success || typeof response.result !== "number") {
        throw new Error("Failed to get memory usage")
    }
    return response.result
}

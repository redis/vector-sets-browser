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
    withscores?: boolean
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

        const baseUrl = getBaseUrl()
        const response = await fetch(`${baseUrl}/api/redis/command/vadd`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ 
                keyName, 
                element, 
                vector: normalizedVector 
            }),
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(
                `HTTP error! status: ${response.status}, message: ${errorText}`
            )
        }

        const data = await response.json()
        if (!data.success) {
            throw new Error(
                `VADD operation failed: ${data.error || "Unknown error"}`
            )
        }

        return data.result
    } catch (error) {
        console.error("VADD operation error:", error)
        throw error
    }
}

export async function vlink(
    keyName: string,
    element: string,
    count: number
): Promise<[string, number][]> {
    try {
        const baseUrl = getBaseUrl()
        const response = await fetch(`${baseUrl}/api/redis/command/vlink`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ keyName, element, count }),
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(
                `HTTP error! status: ${response.status}, message: ${errorText}`
            )
        }

        const data = await response.json()
        if (!data.success) {
            throw new Error(`Failed to get vector links: ${data.error}`)
        }
        
        // Flatten the per-level results into a single array
        const result: [string, number][] = []
        for (const level of data.result) {
            for (const [neighbor, score] of level) {
                result.push([neighbor, score])
            }
        }
        return result
    } catch (error) {
        console.error("VLINK operation error:", error)
        throw error
    }
}

export async function vsim(
    keyName: string,
    searchInput: number[] | string,
    count: number
): Promise<[string, number][]> {
    try {
        const baseUrl = getBaseUrl()
        const response = await fetch(`${baseUrl}/api/redis/command/vsim`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ keyName, searchInput, count }),
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(
                `HTTP error! status: ${response.status}, message: ${errorText}`
            )
        }

        const data = await response.json()
        if (!data.success) {
            throw new Error(data.error || "VSIM operation failed")
        }

        return data.result
    } catch (error) {
        console.error("VSIM operation error:", error)
        return []
    }
}

export async function vdim(keyName: string): Promise<number> {
    try {
        const baseUrl = getBaseUrl()
        const response = await fetch(`${baseUrl}/api/redis/command/vdim`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ keyName }),
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(
                `HTTP error! status: ${response.status}, message: ${errorText}`
            )
        }

        const data = await response.json()
        if (!data.success || typeof data.result !== "number") {
            throw new Error(data.error || "Failed to get vector dimensions")
        }

        return data.result
    } catch (error) {
        console.error("VDIM operation error:", error)
        throw error
    }
}

export async function vcard(keyName: string): Promise<number> {
    try {
        const baseUrl = getBaseUrl()
        const response = await fetch(`${baseUrl}/api/redis/command/vcard`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ keyName }),
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(
                `HTTP error! status: ${response.status}, message: ${errorText}`
            )
        }

        const data = await response.json()
        if (!data.success || typeof data.result !== "number") {
            throw new Error(data.error || "Failed to get vector count")
        }

        return data.result
    } catch (error) {
        console.error("VCARD operation error:", error)
        throw error
    }
}

export async function vrem(keyName: string, element: string): Promise<number> {
    try {
        const baseUrl = getBaseUrl()
        const response = await fetch(`${baseUrl}/api/redis/command/vrem`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ keyName, element }),
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(
                `HTTP error! status: ${response.status}, message: ${errorText}`
            )
        }

        const data = await response.json()
        if (!data.success) {
            throw new Error(`Failed to remove vector: ${data.error || "Unknown error"}`)
        }

        return data.result
    } catch (error) {
        console.error("VREM operation error:", error)
        throw error
    }
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
        const baseUrl = getBaseUrl()
        const response = await fetch(`${baseUrl}/api/redis/command/vemb`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ keyName, element }),
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(
                `HTTP error! status: ${response.status}, message: ${errorText}`
            )
        }

        const data = await response.json()
        if (!data.success) {
            throw new Error(
                `VEMB operation failed: ${data.error || "Unknown error"}`
            )
        }

        // The vector is directly in the result
        const vector = data.result
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

export async function getMemoryUsage(keyName: string): Promise<number> {
    try {
        const baseUrl = getBaseUrl()
        const response = await fetch(`${baseUrl}/api/memory-usage`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ keyName }),
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(
                `HTTP error! status: ${response.status}, message: ${errorText}`
            )
        }

        const data = await response.json()
        if (!data.success || typeof data.result !== "number") {
            throw new Error(data.error || "Failed to get memory usage")
        }

        return data.result
    } catch (error) {
        console.error("Memory usage operation error:", error)
        throw error
    }
}

export async function getVectorInfo(keyName: string): Promise<Record<string, any>> {
    try {
        const baseUrl = getBaseUrl()
        const response = await fetch(`${baseUrl}/api/redis/command/vinfo`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ keyName }),
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(
                `HTTP error! status: ${response.status}, message: ${errorText}`
            )
        }

        const data = await response.json()
        if (!data.success) {
            throw new Error(data.error || "Failed to get vector info")
        }

        return data.result
    } catch (error) {
        console.error("Vector info operation error:", error)
        throw error
    }
}

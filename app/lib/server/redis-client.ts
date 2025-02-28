import { VectorSetMetadata } from "@/app/types/embedding"
import { createClient, RedisClientType } from "redis"

// Types for Redis operations
export interface RedisVectorMetadata {
    data: string
}

export interface VectorOperationResult {
    success: boolean
    error?: string
    result?: any
}

export class RedisClient {
    private static async createConnection(
        url: string
    ): Promise<RedisClientType> {
        const client = createClient({
            url,
            socket: {
                connectTimeout: 5000,
            },
        })

        client.on("error", (err) => console.error("Redis Client Error:", err))
        await client.connect()
        return client
    }

    public static async withConnection<T>(
        url: string,
        operation: (client: RedisClientType) => Promise<T>
    ): Promise<VectorOperationResult> {
        let client: RedisClientType | null = null

        try {
            client = await RedisClient.createConnection(url)
            const result = await operation(client)
            return { success: true, result }
        } catch (error) {
            console.error("Operation failed:", error)
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            }
        } finally {
            if (client) {
                await client.quit().catch(console.error)
            }
        }
    }
}

// Vector operations
export async function scanVectorSets(
    url: string
): Promise<VectorOperationResult> {
    return RedisClient.withConnection(url, async (client) => {
        let cursor = "0"
        const vectorSets = new Set<string>()

        do {
            const [nextCursor, keys] = (await client.sendCommand([
                "SCAN",
                cursor,
                "TYPE",
                "vectorset",
            ])) as [string, string[]]

            keys.forEach((key) => vectorSets.add(key))
            cursor = nextCursor
        } while (cursor !== "0")

        const result = Array.from(vectorSets)
        return result
    })
}

export async function vadd(
    url: string,
    keyName: string,
    element: string,
    vector: number[]
): Promise<VectorOperationResult> {
    return RedisClient.withConnection(url, async (client) => {

        // Ensure vector is an array of numbers
        if (!Array.isArray(vector)) {
            throw new Error(`Invalid vector data: not an array`)
        }

        if (vector.some((v) => typeof v !== "number" || isNaN(v))) {
            throw new Error(`Invalid vector data: contains non-numeric values`)
        }

        const command = [
            "VADD",
            keyName,
            "VALUES",
            vector.length.toString(),
            ...vector.map((v) => v.toString()),
            element,
        ]

        try {
            return await client.sendCommand(command)
        } catch (error) {
            console.error("Error executing VADD command:", error)
            throw new Error(
                `Failed to add vector: ${
                    error instanceof Error ? error.message : String(error)
                }`
            )
        }
    })
}

export async function vsim(
    url: string,
    keyName: string,
    params: { searchVector?: number[]; searchElement?: string; count: number }
): Promise<VectorOperationResult> {
    console.log("VSIM", url, keyName)
    if (!params.searchVector && !params.searchElement) {
        return {
            success: false,
            error: "Either searchVector or searchElement is required",
        }
    }

    return RedisClient.withConnection(url, async (client) => {
        try {
            const baseCommand = ["VSIM", keyName]

            if (params.searchVector) {
                baseCommand.push(
                    "VALUES",
                    String(params.searchVector.length),
                    ...params.searchVector.map(String)
                )
            } else if (params.searchElement) {
                baseCommand.push("ELE", params.searchElement)
            }

            baseCommand.push("WITHSCORES", "COUNT", String(params.count))

            const result = (await client.sendCommand(baseCommand)) as string[]

            if (!result || !Array.isArray(result)) {
                throw new Error("Invalid response from Redis VSIM command")
            }

            // Convert the flat array into pairs of [element, score]
            const pairs: [string, number][] = []
            for (let i = 0; i < result.length; i += 2) {
                const element = result[i]
                const score = result[i + 1]

                if (!element || !score) {
                    console.warn(`Invalid pair at index ${i}:`, {
                        element,
                        score,
                    })
                    continue
                }

                const numScore = parseFloat(score)
                if (isNaN(numScore)) {
                    console.warn(`Invalid score for element ${element}:`, score)
                    continue
                }

                pairs.push([element, numScore])
            }

            return pairs
        } catch (error) {
            console.error("VSIM operation error:", error)
            throw error
        }
    })
}

export async function vdim(
    url: string,
    keyName: string
): Promise<VectorOperationResult> {
    return RedisClient.withConnection(url, async (client) => {
        return client.sendCommand(["VDIM", keyName])
    })
}

export async function vcard(
    url: string,
    keyName: string
): Promise<VectorOperationResult> {
    if (!keyName) {
        console.error("Invalid VCARD parameters:", { keyName })
        return {
            success: false,
            error: `Invalid parameters: keyName=${keyName}`,
        }
    }

    return RedisClient.withConnection(url, async (client) => {
        try {
            const result = await client.sendCommand(["VCARD", String(keyName)])
            
            if (result === null || result === undefined) {
                console.error("Invalid VCARD result:", result)
                throw new Error(`Failed to get cardinality for key ${keyName}`)
            }
            
            // Convert to number if it's not already
            const count = typeof result === 'number' ? result : Number(result)
            
            if (isNaN(count)) {
                console.error("Invalid VCARD result (not a number):", result)
                throw new Error(`Invalid cardinality result for key ${keyName}`)
            }
            
            // Return the count directly, not wrapped in another object
            return count
        } catch (error) {
            console.error("VCARD operation error:", error)
            throw new Error(
                `Failed to get cardinality for key ${keyName}: ${error instanceof Error ? error.message : String(error)}`
            )
        }
    })
}

export async function vrem(
    url: string,
    keyName: string,
    element: string
): Promise<VectorOperationResult> {
    return RedisClient.withConnection(url, async (client) => {
        return client.sendCommand(["VREM", String(keyName), String(element)])
    })
}

export async function vemb(
    url: string,
    keyName: string,
    element: string
): Promise<VectorOperationResult> {
    if (!keyName || !element) {
        console.error("Invalid VEMB parameters:", { keyName, element })
        return {
            success: false,
            error: `Invalid parameters: keyName=${keyName}, element=${element}`,
        }
    }

    return RedisClient.withConnection(url, async (client) => {
        try {
            // Ensure arguments are strings for Redis command
            const args = ["VEMB", String(keyName), String(element)]
            console.log("VEMB command args:", args)
            const result = await client.sendCommand(args)

            if (!result || !Array.isArray(result)) {
                console.error("Invalid VEMB result:", result)
                throw new Error(`Failed to get vector for element ${element}`)
            }

            const vector = result.map((v) => {
                const num = Number(v)
                if (isNaN(num)) {
                    console.warn(
                        `Non-numeric value in vector for ${element}:`,
                        v
                    )
                    return 0
                }
                return num
            })

            return vector
        } catch (error) {
            console.error("VEMB operation error:", error)
            throw new Error(
                `Failed to get vector for element ${element}: ${error.message}`
            )
        }
    })
}

export async function getRedisInfo(
    url: string
): Promise<VectorOperationResult> {
    return RedisClient.withConnection(url, async (client) => {
        return client.info()
    })
}

export async function getMetadata(
    url: string,
    keyName: string
): Promise<VectorOperationResult> {
    return RedisClient.withConnection(url, async (client) => {
        const metadataKey = `${keyName}_metadata`
        const storedData = await client.hGetAll(metadataKey)
        const metadata = storedData.data ? JSON.parse(storedData.data) : null
        return metadata // Return metadata directly without wrapping
    })
}

export async function setMetadata(
    url: string,
    keyName: string,
    metadata: any
): Promise<VectorOperationResult> {
    return RedisClient.withConnection(url, async (client) => {
        const metadataKey = `${keyName}_metadata`
        await client.hSet(metadataKey, { data: JSON.stringify(metadata) })
        return true
    })
}

export async function getMemoryUsage(
    url: string,
    keyName: string
): Promise<VectorOperationResult> {
    return RedisClient.withConnection(url, async (client) => {
        const memoryUsage = await client.sendCommand([
            "MEMORY",
            "USAGE",
            keyName,
        ])

        if (memoryUsage === null || memoryUsage === undefined) {
            const keyType = await client.type(keyName)
            if (keyType === "none") {
                throw new Error("Key does not exist")
            }
        }

        return memoryUsage || 0
    })
}

export async function createVectorSet(
    url: string,
    keyName: string,
    dimensions: number,
    metadata?: VectorSetMetadata,
    customData?: { element: string; vector: number[] }
): Promise<VectorOperationResult> {
    return RedisClient.withConnection(url, async (client) => {
        // Check if key already exists
        const exists = await client.sendCommand(["EXISTS", keyName])
        if (exists) {
            throw new Error("Vector set already exists")
        }

        let effectiveDimensions = dimensions

        // If dimensions is 0 and we have Ollama config, get dimensions from a test embedding
        if (
            metadata?.embedding?.provider === "ollama" &&
            metadata.embedding.ollama
        ) {
            try {
                const ollama = metadata.embedding.ollama
                // Get a test embedding to determine dimensions
                const response = await fetch(ollama.apiUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        model: ollama.modelName,
                        prompt: "test", // Simple test prompt
                    }),
                })
                if (!response.ok) {
                    throw new Error(`Ollama API error: ${response.statusText}`)
                }

                const data = await response.json()
                effectiveDimensions = data.embedding.length
            } catch (error) {
                throw new Error(
                    `Failed to get dimensions from Ollama: ${
                        error instanceof Error ? error.message : String(error)
                    }`
                )
            }
        }
        // If dimensions is 0 and we have TensorFlow config, get dimensions from metadata
        else if (
            metadata?.embedding?.provider === "tensorflow"
        ) {
            try {
                // Get dimensions from metadata
                if (metadata.dimensions) {
                    effectiveDimensions = metadata.dimensions

                } else {
                    throw new Error(
                        "TensorFlow dimensions not found in metadata"
                    )
                }
            } catch (error) {
                throw new Error(
                    `Failed to get dimensions for TensorFlow: ${
                        error instanceof Error ? error.message : String(error)
                    }`
                )
            }
        } else if (!dimensions || dimensions < 2) {
            throw new Error("Dimensions must be at least 2")
        }

        // Create the vector set with either the custom vector or a dummy vector
        const vector = customData?.vector || Array(effectiveDimensions).fill(0)
        const element = customData?.element || "First Vector (Default)"

        // Ensure vector is an array of numbers
        if (!Array.isArray(vector)) {
            throw new Error(`Invalid vector data: not an array`)
        }

        if (vector.some((v) => typeof v !== "number" || isNaN(v))) {
            throw new Error(`Invalid vector data: contains non-numeric values`)
        }

        // Validate vector dimensions
        if (vector.length !== effectiveDimensions) {
            throw new Error(
                `Vector dimensions (${vector.length}) do not match specified dimensions (${effectiveDimensions})`
            )
        }

        // Create the vector set
        const command = ["VADD", keyName]

        // Add REDUCE flag if dimension reduction is configured
        if (metadata?.redisConfig?.reduceDimensions) {
            command.push("REDUCE", metadata.redisConfig.reduceDimensions.toString())
        }

        // Add VALUES and vector data
        command.push(
            "VALUES",
            effectiveDimensions.toString(),
            ...vector.map((v) => v.toString()),
            element
        )

        // Add CAS flag if enabled
        if (metadata?.redisConfig?.defaultCAS) {
            command.push("CAS")
        }

        // Add quantization flag
        if (metadata?.redisConfig?.quantization) {
            command.push(metadata.redisConfig.quantization)
        }

        // Add build exploration factor if configured
        if (metadata?.redisConfig?.buildExplorationFactor) {
            command.push("EF", metadata.redisConfig.buildExplorationFactor.toString())
        }

        // TODO DEBUG
        if (true) {
            console.log("VADD command:", command.join(" "))
        }

        try {
            await client.sendCommand(command)
            
            // Store metadata if provided
            if (metadata) {
                const metadataKey = `${keyName}_metadata`
                await client.hSet(metadataKey, { data: JSON.stringify(metadata) })
            }
            
            return "created"
        } catch (error) {
            console.error("Error executing VADD command:", error)
            throw new Error(
                `Failed to create vector set: ${
                    error instanceof Error ? error.message : String(error)
                }`
            )
        }
    })
}

export async function deleteVectorSet(
    url: string,
    keyName: string
): Promise<VectorOperationResult> {
    return RedisClient.withConnection(url, async (client) => {
        // Delete the key
        const deleteResult = (await client.sendCommand([
            "DEL",
            keyName,
        ])) as number

        if (deleteResult === 0) {
            throw new Error(`Failed to delete vector set '${keyName}'`)
        }

        // Also delete metadata
        const metadataKey = `${keyName}_metadata`
        await client.del(metadataKey)

        return "deleted"
    })
}

export async function vlink(
    url: string,
    keyName: string,
    element: string,
    count: number = 10
): Promise<VectorOperationResult> {
    if (!keyName || !element) {
        console.error("Invalid VLINK parameters:", { keyName, element })
        return {
            success: false,
            error: `Invalid parameters: keyName=${keyName}, element=${element}`,
        }
    }

    return RedisClient.withConnection(url, async (client) => {
        try {
            // Ensure arguments are strings for Redis command
            const args = ["VLINKS", String(keyName), String(element), "WITHSCORES"]
            console.log("VLINKS command args:", args)
            const result = await client.sendCommand(args)

            if (!result || !Array.isArray(result)) {
                console.error("Invalid VLINKS result:", result)
                throw new Error(`Failed to get links for element ${element}`)
            }

            // Process the result - it's an array of arrays, where each sub-array
            // represents the neighbors at one level
            const processedResult: [string, number][][] = []
            
            for (let i = 0; i < result.length; i++) {
                const levelLinks = result[i]
                if (!Array.isArray(levelLinks)) {
                    console.warn(`Invalid level links at index ${i}:`, levelLinks)
                    continue
                }
                
                // Each level is a map of element -> score
                const levelPairs: [string, number][] = []
                for (let j = 0; j < levelLinks.length; j += 2) {
                    const neighbor = levelLinks[j]
                    const score = levelLinks[j + 1]
                    
                    if (!neighbor || !score) {
                        console.warn(`Invalid neighbor/score pair at level ${i}, index ${j}:`, { neighbor, score })
                        continue
                    }
                    
                    const numScore = parseFloat(score)
                    if (isNaN(numScore)) {
                        console.warn(`Invalid score for neighbor ${neighbor}:`, score)
                        continue
                    }
                    
                    levelPairs.push([neighbor, numScore])
                }
                
                processedResult.push(levelPairs)
            }

            return processedResult
        } catch (error) {
            console.error("VLINKS operation error:", error)
            throw new Error(
                `Failed to get links for element ${element}: ${error.message}`
            )
        }
    })
}

export async function vinfo(
    url: string,
    keyName: string
): Promise<VectorOperationResult> {
    if (!keyName) {
        console.error("Invalid VINFO parameters:", { keyName })
        return {
            success: false,
            error: `Invalid parameters: keyName=${keyName}`,
        }
    }

    return RedisClient.withConnection(url, async (client) => {
        try {
            // Ensure arguments are strings for Redis command
            const args = ["VINFO", String(keyName)]
            console.log("VINFO command args:", args)
            const result = await client.sendCommand(args)

            if (!result) {
                console.error("Invalid VINFO result:", result)
                throw new Error(`Failed to get vector info for key ${keyName}`)
            }

            // Process the result - it's a map of key-value pairs
            const info: Record<string, any> = {}
            
            // Redis returns this as an array of alternating keys and values
            if (Array.isArray(result)) {
                for (let i = 0; i < result.length; i += 2) {
                    const key = result[i]
                    const value = result[i + 1]
                    
                    if (key && value !== undefined) {
                        // Convert numeric strings to numbers
                        if (typeof value === 'string' && !isNaN(Number(value))) {
                            info[key] = Number(value)
                        } else {
                            info[key] = value
                        }
                    }
                }
            }
            console.log("VINFO result:", info) 
            
            return info
        } catch (error) {
            console.error("VINFO operation error:", error)
            throw new Error(
                `Failed to get vector info for key ${keyName}: ${error instanceof Error ? error.message : String(error)}`
            )
        }
    })
}

export default RedisClient

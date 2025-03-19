import {
    validateAndCorrectMetadata,
    VectorSetMetadata,
} from "@/app/embeddings/types/config"
import { cookies } from "next/headers"
import { createClient, RedisClientType } from "redis"

// Types for Redis operations
export interface RedisVectorMetadata {
    data: string
}

export interface VectorOperationResult {
    success: boolean
    error?: string
    result?:
        | number
        | number[]
        | [string, number, number[]][]
        | [string, number, number[]][][]
        | any
    executionTimeMs?: number
    executedCommand?: string
}

// Helper to get Redis URL from cookies
export function getRedisUrl(): string | null {
    const url = cookies().get("redis_url")?.value
    return url || null
}

export class RedisClient {
    private static connectionPool: Map<
        string,
        {
            client: RedisClientType
            lastUsed: number
            isConnecting: boolean
        }
    > = new Map()

    private static readonly CONNECTION_TIMEOUT = 60000 // 1 minute timeout
    private static cleanupInterval: NodeJS.Timeout | null = null

    private static async getConnection(url: string): Promise<RedisClientType> {
        // Check if we have an existing connection
        const existingConnection = this.connectionPool.get(url)

        if (existingConnection) {
            // If connection exists and is connecting, wait for it
            if (existingConnection.isConnecting) {
                let attempts = 0
                while (existingConnection.isConnecting && attempts < 10) {
                    await new Promise((resolve) => setTimeout(resolve, 100))
                    attempts++
                }
            }

            // Update last used timestamp
            existingConnection.lastUsed = Date.now()

            // Check if connection is still valid
            try {
                if (existingConnection.client.isOpen) {
                    return existingConnection.client
                }
                // If connection is closed, we'll create a new one below
            } catch (error) {
                console.warn(
                    "[RedisClient] Error checking connection status:",
                    error
                )
                // We'll create a new connection below
            }
        }

        // Create a new connection
        const connectionInfo = {
            client: null as unknown as RedisClientType,
            lastUsed: Date.now(),
            isConnecting: true,
        }

        this.connectionPool.set(url, connectionInfo)

        try {
            const client = createClient({
                url,
                socket: {
                    connectTimeout: 5000,
                },
            })

            client.on("error", (err) =>
                console.error("Redis Client Error:", err)
            )
            await client.connect()

            connectionInfo.client = client
            connectionInfo.isConnecting = false

            // Start cleanup interval if not already running
            if (!this.cleanupInterval) {
                this.cleanupInterval = setInterval(
                    () => this.cleanupConnections(),
                    this.CONNECTION_TIMEOUT
                )
            }

            return client
        } catch (error) {
            connectionInfo.isConnecting = false
            this.connectionPool.delete(url)
            throw error
        }
    }

    private static async cleanupConnections() {
        const now = Date.now()
        const expiredUrls: string[] = []

        // Find expired connections
        Array.from(this.connectionPool.entries()).forEach(([url, connection]) => {
            if (now - connection.lastUsed > this.CONNECTION_TIMEOUT) {
                expiredUrls.push(url)
            }
        })

        // Close expired connections
        for (const url of expiredUrls) {
            const connection = this.connectionPool.get(url)
            if (connection) {
                try {
                    await connection.client.quit()
                    console.log(
                        `[RedisClient] Closed idle connection for ${url}`
                    )
                } catch (error) {
                    console.error(
                        `[RedisClient] Error closing idle connection for ${url}:`,
                        error
                    )
                }
                this.connectionPool.delete(url)
            }
        }

        // Clear interval if no more connections
        if (this.connectionPool.size === 0 && this.cleanupInterval) {
            clearInterval(this.cleanupInterval)
            this.cleanupInterval = null
        }
    }

    public static async withConnection<T>(
        url: string,
        operation: (client: RedisClientType) => Promise<T>
    ): Promise<VectorOperationResult> {
        try {
            const client = await RedisClient.getConnection(url)
            const result = await operation(client)

            // Check if the result is already a VectorOperationResult with success: false
            if (
                result &&
                typeof result === "object" &&
                "success" in result &&
                result.success === false
            ) {
                // Pass through the error result without wrapping it
                return result as VectorOperationResult
            }

            return { success: true, result }
        } catch (error) {
            console.error("[RedisClient] Operation failed:", error)
            console.error("[RedisClient] Error details:", {
                name: error.name,
                message: error.message,
                stack: error.stack,
            })
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            }
        }
    }

    // Add a method to explicitly close all connections (useful for cleanup)
    public static async closeAllConnections(): Promise<void> {
        await Promise.all(
            Array.from(this.connectionPool.entries()).map(async ([url, connection]) => {
                try {
                    await connection.client.quit()
                    console.log(`[RedisClient] Closed connection for ${url}`)
                } catch (error) {
                    console.error(
                        `[RedisClient] Error closing connection for ${url}:`,
                        error
                    )
                }
            })
        )

        this.connectionPool.clear()

        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval)
            this.cleanupInterval = null
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
    vector: number[],
    attributes?: string,
    useCAS?: boolean,
    reduceDimensions?: number
): Promise<VectorOperationResult> {
    return RedisClient.withConnection(url, async (client) => {
        // Ensure vector is an array of numbers
        if (!Array.isArray(vector)) {
            return {
                success: false,
                error: `Invalid vector data: not an array`,
            }
        }

        if (vector.some((v) => typeof v !== "number" || isNaN(v))) {
            return {
                success: false,
                error: `Invalid vector data: contains non-numeric values`,
            }
        }

        const command = ["VADD", keyName]

        if (reduceDimensions) {
            command.push("REDUCE", reduceDimensions.toString())
        }

        command.push(
            "VALUES",
            vector.length.toString(),
            ...vector.map((v) => v.toString()),
            element
        )

        if (attributes) {
            command.push("SETATTR", attributes)
        }

        // Add CAS flag if enabled
        if (useCAS) {
            command.push("CAS")
        }

        try {
            const result = await client.sendCommand(command)
            return result
        } catch (error) {
            console.error("Error executing VADD command:", error)
            return {
                success: false,
                error: `${
                    error instanceof Error ? error.message : String(error)
                }`,
            }
        }
    })
}

export async function vgetattr(
    url: string,
    keyName: string,
    element: string
): Promise<VectorOperationResult> {
    return RedisClient.withConnection(url, async (client) => {
        const command = ["VGETATTR", keyName, element]

        try {
            const result = await client.sendCommand(command)
            return result
        } catch (error) {
            console.error("Error executing VGETATTR command:", error)
            return {
                success: false,
                error: `Failed to get vector attributes: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            }
        }
    })
}

export async function vsetattr(
    url: string,
    keyName: string,
    element: string,
    attribute: string,
    value: string
): Promise<VectorOperationResult> {
    return RedisClient.withConnection(url, async (client) => {
        const command = ["VSETATTR", keyName, element, value]

        try {
            const result = await client.sendCommand(command)
            return result
        } catch (error) {
            console.error("Error executing VSETATTR command:", error)
            return {
                success: false,
                error: `Failed to set vector attributes: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            }
        }
    })
}
export async function vsim(
    url: string,
    keyName: string,
    params: {
        searchVector?: number[]
        searchElement?: string
        count: number
        needVectors?: boolean
        filter?: string
        expansionFactor?: number
    }
): Promise<VectorOperationResult> {
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

            if (params.filter && params.filter !== "") {
                baseCommand.push("FILTER", params.filter)
            }

            baseCommand.push("WITHSCORES", "COUNT", String(params.count))

            // Add EF parameter if provided
            if (params.expansionFactor && params.expansionFactor > 0) {
                baseCommand.push("EF", String(params.expansionFactor))
            }

            // Start timing the Redis command execution
            const startTime = performance.now()
            const result = (await client.sendCommand(baseCommand)) as string[]
            const endTime = performance.now()
            const executionTimeMs = endTime - startTime

            if (!result || !Array.isArray(result)) {
                throw new Error("Invalid response from Redis VSIM command")
            }

            // Convert the flat array into tuples of [element, score]
            const elements: string[] = []
            const tuples: [string, number, number[]][] = []

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

                elements.push(element)
                tuples.push([element, numScore, []])
            }

            // Fetch vectors in bulk if needed
            if (params.needVectors && elements.length > 0) {
                const vectorResult = await vemb_multi(url, keyName, elements)
                if (
                    vectorResult.success &&
                    Array.isArray(vectorResult.result)
                ) {
                    // Update tuples with vectors
                    for (let i = 0; i < elements.length; i++) {
                        if (vectorResult.result[i]) {
                            tuples[i][2] = vectorResult.result[i]
                        }
                    }
                }
            }

            return {
                success: true,
                result: tuples,
                executionTimeMs,
                executedCommand: baseCommand.join(" "),
            }
        } catch (error) {
            console.error("VSIM operation error:", error)
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            }
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
            const count = typeof result === "number" ? result : Number(result)

            if (isNaN(count)) {
                console.error("Invalid VCARD result (not a number):", result)
                throw new Error(`Invalid cardinality result for key ${keyName}`)
            }

            // Return the count directly, not wrapped in another object
            return count
        } catch (error) {
            console.error("VCARD operation error:", error)
            throw new Error(
                `Failed to get cardinality for key ${keyName}: ${
                    error instanceof Error ? error.message : String(error)
                }`
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
            const result = await client.sendCommand(args)

            if (!result || !Array.isArray(result)) {
                console.error("Invalid VEMB result:", result)
                throw new Error(`Failed to get vector`)
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

            return {
                success: true,
                result: vector,
            }
        } catch (error) {
            console.error("VEMB operation error:", error)
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            }
        }
    })
}

export async function vemb_multi(
    url: string,
    keyName: string,
    elements: string[]
): Promise<VectorOperationResult> {
    if (!keyName || !elements || elements.length === 0) {
        console.error("Invalid VEMB batch parameters:", { keyName, elements })
        return {
            success: false,
            error: `Invalid parameters: keyName=${keyName}, elements=${elements}`,
        }
    }

    return RedisClient.withConnection(url, async (client) => {
        try {
            const multi = client.multi()
            // Map elements to promises of VEMB commands
            elements.forEach((element) =>
                multi.addCommand(["VEMB", String(keyName), String(element)])
            )

            // Execute all commands in parallel
            const results = await multi.exec()

            // Process results
            const vectors = results.map((value, index) => {
                if (!Array.isArray(value)) {
                    console.warn(
                        `Invalid vector data for element ${elements[index]}:`,
                        value
                    )
                    return null
                }

                return value.map((v) => {
                    const num = Number(v)
                    return isNaN(num) ? 0 : num
                })
            })

            return vectors.filter((v) => v !== null)
        } catch (error) {
            console.error("VEMB batch operation error:", error)
            throw new Error(
                `Failed to get vectors for elements: ${
                    error instanceof Error ? error.message : String(error)
                }`
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
        const configKey = "vector-set-browser:config"
        const hashKey = `vset:${keyName}:metadata`
        const oldMetadataKey = `${keyName}_metadata`

        // First try to get data from the new location
        let storedData = await client.hGet(configKey, hashKey)

        // If no data in new location, check old location
        if (!storedData) {
            const oldData = await client.hGetAll(oldMetadataKey)
            if (oldData && oldData.data) {
                console.log(
                    `Migrating metadata for ${keyName} from old key structure`
                )
                storedData = oldData.data

                // Migrate the data to new location
                await client.hSet(configKey, {
                    [hashKey]: storedData,
                })

                // Delete the old key
                await client.del(oldMetadataKey)
            }
        }

        try {
            // Parse the stored data
            const parsedData = storedData ? JSON.parse(storedData) : null

            // Validate and correct the metadata
            const validatedMetadata = validateAndCorrectMetadata(parsedData)

            // If the metadata needed correction, write it back to Redis
            if (
                parsedData &&
                JSON.stringify(validatedMetadata) !== JSON.stringify(parsedData)
            ) {
                await client.hSet(configKey, {
                    [hashKey]: JSON.stringify(validatedMetadata),
                })
            }

            return validatedMetadata
        } catch (error) {
            console.error(`Error processing metadata for ${keyName}:`, error)
            // Return a default metadata object in case of error
            const defaultMetadata = validateAndCorrectMetadata(null)
            await client.hSet(configKey, {
                [hashKey]: JSON.stringify(defaultMetadata),
            })
            return defaultMetadata
        }
    })
}

export async function setMetadata(
    url: string,
    keyName: string,
    metadata: unknown
): Promise<VectorOperationResult> {
    return RedisClient.withConnection(url, async (client) => {
        // Validate and correct the metadata before storing
        const validatedMetadata = validateAndCorrectMetadata(metadata)

        const configKey = "vector-set-browser:config"
        const hashKey = `vset:${keyName}:metadata`
        await client.hSet(configKey, {
            [hashKey]: JSON.stringify(validatedMetadata),
        })
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
        else if (metadata?.embedding?.provider === "tensorflow") {
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
            command.push(
                "REDUCE",
                metadata.redisConfig.reduceDimensions.toString()
            )
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
            command.push(
                "EF",
                metadata.redisConfig.buildExplorationFactor.toString()
            )
        }

        try {
            await client.sendCommand(command)

            // Store metadata if provided
            if (metadata) {
                const configKey = "vector-set-browser:config"
                const hashKey = `vset:${keyName}:metadata`
                await client.hSet(configKey, {
                    [hashKey]: JSON.stringify(metadata),
                })
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

        // Also delete metadata from the consolidated config
        const configKey = "vector-set-browser:config"
        const hashKey = `vset:${keyName}:metadata`
        await client.hDel(configKey, hashKey)

        return "deleted"
    })
}

export async function vlinks(
    url: string,
    keyName: string,
    element: string,
    count: number = 10
): Promise<VectorOperationResult> {
    if (!keyName || !element) {
        console.error("Invalid VLINKS parameters:", { keyName, element })
        return {
            success: false,
            error: `Invalid parameters: keyName=${keyName}, element=${element}`,
        }
    }

    return RedisClient.withConnection(url, async (client) => {
        try {
            // Ensure arguments are strings for Redis command
            const args = [
                "VLINKS",
                String(keyName),
                String(element),
                "WITHSCORES",
            ]

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
                    console.warn(
                        `Invalid level links at index ${i}:`,
                        levelLinks
                    )
                    continue
                }

                // Each level is a map of element -> score
                const levelTuples: [string, number][] = []
                for (let j = 0; j < levelLinks.length; j += 2) {
                    const neighbor = levelLinks[j]
                    const score = levelLinks[j + 1]

                    if (!neighbor || !score) {
                        console.warn(
                            `Invalid neighbor/score pair at level ${i}, index ${j}:`,
                            { neighbor, score }
                        )
                        continue
                    }

                    const numScore = parseFloat(score)
                    if (isNaN(numScore)) {
                        console.warn(
                            `Invalid score for neighbor ${neighbor}:`,
                            score
                        )
                        continue
                    }

                    levelTuples.push([neighbor, numScore])
                }

                processedResult.push(levelTuples)
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
                        if (
                            typeof value === "string" &&
                            !isNaN(Number(value))
                        ) {
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
                `Failed to get vector info for key ${keyName}: ${
                    error instanceof Error ? error.message : String(error)
                }`
            )
        }
    })
}

export default RedisClient

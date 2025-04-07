import { EmbeddingService } from "@/app/embeddings/service"
import { getExpectedDimensions } from "@/app/embeddings/types/embeddingModels"
import { VaddMultiRequestBody, VaddRequestBody } from "@/app/redis-server/api"
import {
    VectorSetMetadata,
} from "@/app/types/vectorSetMetaData"
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
export async function getRedisUrl(): Promise<string | null> {
    const url = (await cookies()).get("redis_url")?.value
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
        Array.from(this.connectionPool.entries()).forEach(
            ([url, connection]) => {
                if (now - connection.lastUsed > this.CONNECTION_TIMEOUT) {
                    expiredUrls.push(url)
                }
            }
        )

        // Close expired connections
        for (const url of expiredUrls) {
            const connection = this.connectionPool.get(url)
            if (connection) {
                try {
                    await connection.client.quit()
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
                "success" in result
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
            Array.from(this.connectionPool.entries()).map(
                async ([url, connection]) => {
                    try {
                        await connection.client.quit()
                    } catch (error) {
                        console.error(
                            `[RedisClient] Error closing connection for ${url}:`,
                            error
                        )
                    }
                }
            )
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
        try {
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
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }
        }
    })
}

export async function vadd(redisUrl: string, request: VaddRequestBody) : Promise<VectorOperationResult> {
    
    return RedisClient.withConnection(redisUrl, async (client) => {

        // Ensure vector is an array of numbers
        if (!Array.isArray(request.vector)) {
            return {
                success: false,
                error: `Invalid vector data: not an array`,
            }
        }

        if (request.vector.some((v) => typeof v !== "number" || isNaN(v))) {
            return {
                success: false,
                error: `Invalid vector data: contains non-numeric values`,
            }
        }

        const command = ["VADD", request.keyName]

        if (request.reduceDimensions) {
            command.push("REDUCE", request.reduceDimensions.toString())
        }

        command.push(
            "VALUES",
            request.vector.length.toString(),
            ...request.vector.map((v) => v.toString()),
            request.element
        )

        if (request.attributes) {
            command.push("SETATTR", request.attributes)
        }

        // Add CAS flag if enabled
        if (request.useCAS) {
            command.push("CAS")
        }
        if (request.quantization) {
            command.push(request.quantization)
        }

        if (request.ef) {
            command.push("EF", request.ef.toString())
        }

        const finalCommand = command.join(" ")

        // If returnCommandOnly is set, just return the command string
        if (request.returnCommandOnly) {
            return {
                success: true,
                executedCommand: finalCommand,
            }
        }

        try {
            const result = await client.sendCommand(command)
            return {
                success: true,
                result,
                executedCommand: finalCommand,
            }
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

    return await RedisClient.withConnection(url, async (client) => {
        try {
            const baseCommand = ["VSIM", keyName]

            if (params.searchVector) {
                // Validate vector values
                if (params.searchVector.some(v => typeof v !== 'number' || isNaN(v) || !isFinite(v))) {
                    console.error("Invalid vector values:", params.searchVector)
                    throw new Error("Vector contains invalid values (NaN or Infinity)")
                }

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
            const err = error instanceof Error ? error.message : String(error)
            
            // special case - element not found should not be an "Error"
            if (err.includes("element not found")) {
                return {
                    success: true,
                    result: [],
                }
            } else {
                console.error("VSIM operation error:", error)
                return {
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                }
            }
        }
    })
}

export async function vdim(
    url: string,
    keyName: string
): Promise<VectorOperationResult> {
    if (!keyName) {
        console.error("Invalid VDIM parameters:", { keyName })
        return {
            success: false,
            error: `Invalid parameters: keyName=${keyName}`,
        }
    }

    return RedisClient.withConnection(url, async (client) => {
        try {
            const result = await client.sendCommand(["VDIM", keyName])
            
            if (result === null || result === undefined) {
                throw new Error(`Failed to get dimensions for key ${keyName}`)
            }

            // Convert to number if it's not already
            const dim = typeof result === "number" ? result : Number(result)

            if (isNaN(dim)) {
                throw new Error(`Invalid dimension result for key ${keyName}`)
            }

            return dim;
        } catch (error) {
            console.error("VDIM operation error:", error)
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }
        }
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
export async function vrem_multi(
    url: string,
    keyName: string,
    elements: string[]
): Promise<VectorOperationResult> {
    return RedisClient.withConnection(url, async (client) => {
        const multi = client.multi()
        // Map elements to promises of VEMB commands
        elements.forEach((element) =>
            multi.addCommand(["VREM", String(keyName), String(element)])
        )

        // Execute all commands in parallel
        const results = await multi.exec()
        console.log("Results:", results)
        return true 

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

        let storedData = await client.hGet(configKey, hashKey)

        try {
            // Parse the stored data
            const parsedData = storedData ? JSON.parse(storedData) : null

            // Validate and correct the metadata
           // const validatedMetadata = validateAndCorrectMetadata(parsedData)
            const validatedMetadata = parsedData 

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
            // const defaultMetadata = validateAndCorrectMetadata(null)
            
            // await client.hSet(configKey, {
            //     [hashKey]: JSON.stringify(defaultMetadata),
            // })
            // return defaultMetadata
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
        //const validatedMetadata = validateAndCorrectMetadata(metadata)

        const configKey = "vector-set-browser:config"
        const hashKey = `vset:${keyName}:metadata`
        await client.hSet(configKey, {
            [hashKey]: JSON.stringify(metadata),
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

        // If dimensions is not specified or zero, try to determine from metadata and/or embedding service
        if (!dimensions || dimensions < 2) {
            // First, try to get dimensions from metadata directly
            if (metadata?.dimensions && metadata.dimensions >= 2) {
                effectiveDimensions = metadata.dimensions;
                console.log(`Using dimensions from metadata: ${effectiveDimensions}`)
            } 
            // If not available in metadata, try to determine from embedding configuration
            else if (metadata?.embedding) {
                try {
                    // Try to get expected dimensions from config
                    const expectedDimensions = getExpectedDimensions(metadata.embedding)
                    
                    if (expectedDimensions >= 2) {
                        effectiveDimensions = expectedDimensions
                        console.log(`Using dimensions from config: ${effectiveDimensions}`)
                    } else {
                        // If can't determine from config, use EmbeddingService to get a test embedding
                        const embeddingService = new EmbeddingService()
                        console.log("Getting dimensions from EmbeddingService")
                        console.log("metadata.embedding", metadata.embedding)
                        
                        // Get a test embedding to determine dimensions
                        const testEmbedding = await embeddingService.getEmbedding("test", metadata.embedding)
                        effectiveDimensions = testEmbedding.length
                        console.log(`Determined dimensions using test embedding: ${effectiveDimensions}`)
                    }
                } catch (error) {
                    throw new Error(
                        `Failed to determine vector dimensions: ${
                            error instanceof Error ? error.message : String(error)
                        }`
                    )
                }
            } else {
                throw new Error("Dimensions must be at least 2")
            }
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

            return info;
        } catch (error) {
            console.error("VINFO operation error:", error)
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            }
        }
    })
}

export async function vadd_multi(
    url: string,
    request: VaddMultiRequestBody
): Promise<VectorOperationResult> {
    return RedisClient.withConnection(url, async (client) => {
        try {
            const multi = client.multi()
            
            for (let i = 0; i < request.elements.length; i++) {
                const command = ["VADD", request.keyName]
                
                if (request.reduceDimensions) {
                    command.push("REDUCE", request.reduceDimensions.toString())
                }
                
                command.push(
                    "VALUES",
                    request.vectors[i].length.toString(),
                    ...request.vectors[i].map(v => v.toString()),
                    request.elements[i]
                )
                
                if (request.attributes && request.attributes[i]) {
                    command.push("SETATTR", JSON.stringify(request.attributes[i]))
                }
                
                if (request.useCAS) {
                    command.push("CAS")
                }
                
                if (request.ef) {
                    command.push("EF", request.ef.toString())
                }
                
                multi.addCommand(command)
            }
            
            const results = await multi.exec()
            return {
                success: true,
                result: results
            }
        } catch (error) {
            console.error("Error in VADD_MULTI operation:", error)
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }
        }
    })
}

export default RedisClient

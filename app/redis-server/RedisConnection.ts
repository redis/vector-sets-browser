import { createClient } from "redis"
import { cookies } from "next/headers"

export interface RedisOperationResult<T> {
    success: boolean
    result?: T
    error?: string
    executionTimeMs?: number
    executedCommand?: string
}

// Helper to get Redis URL from cookies
export async function getRedisUrl(): Promise<string | null> {
    const url = (await cookies()).get("redis_url")?.value
    return url || null
}

// Define a type alias for our Redis client to avoid type mismatches
type RedisClient = ReturnType<typeof createClient>

export class RedisConnection {
    private static connectionPool: Map<
        string,
        {
            client: RedisClient
            lastUsed: number
            isConnecting: boolean
        }
    > = new Map()

    private static readonly CONNECTION_TIMEOUT = 60000 // 1 minute timeout
    private static cleanupInterval: NodeJS.Timeout | null = null

    private static async getClient(url: string): Promise<RedisClient> {
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
            } catch (error) {
                console.warn("[RedisConnection] Error checking connection status:", error)
            }
        }

        // Create a new connection
        const connectionInfo = {
            client: null as unknown as RedisClient,
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

            client.on("error", (err) => console.error("Redis Client Error:", err))
            await client.connect()

            connectionInfo.client = client as RedisClient
            connectionInfo.isConnecting = false

            // Start cleanup interval if not already running
            if (!this.cleanupInterval) {
                this.cleanupInterval = setInterval(
                    () => this.cleanupConnections(),
                    this.CONNECTION_TIMEOUT
                )
            }

            return client as RedisClient
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
                } catch (error) {
                    console.error(
                        `[RedisConnection] Error closing idle connection for ${url}:`,
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

    public static async withClient<T>(
        url: string,
        operation: (client: RedisClient) => Promise<T>
    ): Promise<RedisOperationResult<T>> {
        try {
            const startTime = performance.now()
            const client = await RedisConnection.getClient(url)
            const result = await operation(client)
            const endTime = performance.now()

            return {
                success: true,
                result,
                executionTimeMs: endTime - startTime
            }
        } catch (error) {
            console.error("[RedisConnection] Operation failed:", error)
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }
        }
    }

    // Add a method to explicitly close all connections (useful for cleanup)
    public static async closeAllConnections(): Promise<void> {
        await Promise.all(
            Array.from(this.connectionPool.entries()).map(async ([url, connection]) => {
                try {
                    await connection.client.quit()
                } catch (error) {
                    console.error(
                        `[RedisConnection] Error closing connection for ${url}:`,
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
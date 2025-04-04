import { RedisClient, getRedisUrl } from "@/app/redis-server/server/commands"
import { NextResponse } from "next/server"
import { EmbeddingConfig } from "@/app/embeddings/types/embeddingModels"

// Redis key for storing cache configuration
const CONFIG_KEY = "vector-set-browser:config"

const EMBEDDING_CACHE_CONFIG_KEY = "embedding_cache_config"

// Default cache configuration
const DEFAULT_CACHE_CONFIG = {
    maxSize: 1000,
    defaultTTL: 86400, // 24 hours in seconds
    useCache: true,
    embeddingConfig: {
        provider: "none",
        none: {
            model: "default",
            dimensions: 1536,
        },
    },
}

interface CacheConfig {
    maxSize: number
    defaultTTL: number
    useCache: boolean
    embeddingConfig?: EmbeddingConfig
}

export async function GET() {
    try {
        const redisUrl = await getRedisUrl()
        if (!redisUrl) {
            return NextResponse.json(
                { success: false, error: "No Redis URL configured" },
                { status: 400 }
            )
        }

        const result = await RedisClient.withConnection(
            redisUrl,
            async (client) => {
                const configJson = await client.hGet(
                    CONFIG_KEY,
                    EMBEDDING_CACHE_CONFIG_KEY
                )
                
                // If no configuration exists, return the default
                if (!configJson) {
                    return DEFAULT_CACHE_CONFIG
                }
                
                try {
                    return JSON.parse(configJson)
                } catch (err) {
                    console.error("[Cache Config] Error parsing config:", err)
                    return DEFAULT_CACHE_CONFIG
                }
            }
        )

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 500 }
            )
        }

        return NextResponse.json({ success: true, ...result.result })
    } catch (error) {
        console.error("[Cache Config] Error getting config:", error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        )
    }
}

export async function POST(request: Request) {
    try {
        const redisUrl = await getRedisUrl()
        if (!redisUrl) {
            return NextResponse.json(
                { success: false, error: "No Redis URL configured" },
                { status: 400 }
            )
        }

        // Parse the request body
        const body = await request.json()
        const { action, params } = body

        if (action !== "setConfig" || !params) {
            return NextResponse.json(
                { success: false, error: "Invalid request format" },
                { status: 400 }
            )
        }

        // Validate the configuration
        const config = params as CacheConfig
        if (
            typeof config.maxSize !== "number" ||
            typeof config.defaultTTL !== "number" ||
            typeof config.useCache !== "boolean"
        ) {
            return NextResponse.json(
                { success: false, error: "Invalid configuration parameters" },
                { status: 400 }
            )
        }

        const result = await RedisClient.withConnection(
            redisUrl,
            async (client) => {
                // Store the configuration as JSON
                await client.hSet(
                    CONFIG_KEY,
                    EMBEDDING_CACHE_CONFIG_KEY,
                    JSON.stringify(config)
                )
                return true
            }
        )

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 500 }
            )
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[Cache Config] Error setting config:", error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        )
    }
} 
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { RedisClient } from "@/app/lib/server/redis-client"

const REDIS_URL_COOKIE = "redis_url"
const EMBEDDING_CACHE_KEY = "embeddingCache"
const EMBEDDING_CACHE_LOG_KEY = "embeddingCache:log"

// Helper to get Redis URL from cookies
function getRedisUrl(): string | null {
    const url = cookies().get(REDIS_URL_COOKIE)?.value
    return url || null
}

export async function GET(request: NextRequest) {
    try {
        const url = getRedisUrl()
        if (!url) {
            return NextResponse.json(
                { success: false, error: "No Redis URL configured" },
                { status: 400 }
            )
        }

        const result = await RedisClient.withConnection(url, async (client) => {
            // Get the total number of cached embeddings
            const size = await client.hLen(EMBEDDING_CACHE_KEY)
            return { size }
        })

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 500 }
            )
        }

        return NextResponse.json({ success: true, ...result.result })
    } catch (error) {
        console.error("[Cache] Error getting cache info:", error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        )
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const url = getRedisUrl()
        if (!url) {
            return NextResponse.json(
                { success: false, error: "No Redis URL configured" },
                { status: 400 }
            )
        }

        const result = await RedisClient.withConnection(url, async (client) => {
            // Delete both the cache and the log
            await client.del(EMBEDDING_CACHE_KEY)
            await client.del(EMBEDDING_CACHE_LOG_KEY)
            return true
        })

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 500 }
            )
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[Cache] Error clearing cache:", error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        )
    }
} 
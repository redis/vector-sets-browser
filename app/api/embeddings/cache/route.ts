import { RedisConnection, getRedisUrl } from "@/app/redis-server/RedisConnection"
import { NextResponse } from "next/server"
import { EMBEDDING_CACHE_KEY, EMBEDDING_CACHE_LOG_KEY } from "@/app/embeddings/cache/redis-cache"

export async function GET() {
    try {
        const redisUrl = await getRedisUrl()
        if (!redisUrl) {
            return NextResponse.json(
                { success: false, error: "No Redis URL configured" },
                { status: 400 }
            )
        }

        const result = await RedisConnection.withClient(
            redisUrl,
            async (client) => {
                // Get the total number of cached embeddings
                const size = await client.hLen(EMBEDDING_CACHE_KEY)
                return { size }
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

export async function DELETE() {
    try {
        const redisUrl = await getRedisUrl()
        if (!redisUrl) {
            return NextResponse.json(
                { success: false, error: "No Redis URL configured" },
                { status: 400 }
            )
        }

        const result = await RedisConnection.withClient(
            redisUrl,
            async (client) => {
                // Delete both the cache and the log
                await client.del(EMBEDDING_CACHE_KEY)
                await client.del(EMBEDDING_CACHE_LOG_KEY)
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
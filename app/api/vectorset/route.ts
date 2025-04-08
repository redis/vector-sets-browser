import { NextResponse } from "next/server"
import {
    RedisConnection,
    getRedisUrl,
} from "@/app/redis-server/RedisConnection"

// GET /api/vectorset - List all vector sets (scanVectorSets)

export async function GET() {
    const redisUrl = await getRedisUrl()
    if (!redisUrl) {
        return NextResponse.json(
            { success: false, error: "No Redis connection available" },
            { status: 401 }
        )
    }

    try {
        const response = await RedisConnection.withClient(redisUrl, async (client) => {
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

                return Array.from(vectorSets)
            } catch (error) {
                return []
            }
        })

        if (!response || !response.success) {
            return NextResponse.json(
                { success: false, error: "Error calling scanVectorSets" },
                { status: 404 }
            )
        }

        return NextResponse.json({
            success: true,
            result: response.result,
            executionTimeMs: response.executionTimeMs,
        })

    } catch (error) {
        console.error("Error in scanVectorSets API (GET):", error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        )
    }
}

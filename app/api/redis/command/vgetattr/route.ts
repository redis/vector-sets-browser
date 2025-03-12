import { NextRequest, NextResponse } from "next/server"
import { RedisClient } from "@/app/lib/server/redis-client"
import { VgetAttrRequest } from "@/app/api/types"
import { getRedisUrl } from "@/app/lib/server/redis-client" 

export async function POST(request: NextRequest) {
    try {
        const { keyName, element } = (await request.json()) as VgetAttrRequest

        const url = getRedisUrl()
        if (!url) {
            return NextResponse.json(
                { success: false, error: "No Redis connection available" },
                { status: 401 }
            )
        }

        const redisResult = await RedisClient.withConnection(url, async (client) => {
            const command = ["VGETATTR", keyName, element]
            return await client.sendCommand(command)
        })

        if (!redisResult.success) {
            return NextResponse.json({
                success: false,
                error: redisResult.error || "Failed to get vector attributes"
            }, { status: 500 })
        }

        const result = redisResult.result

        // Handle null/empty response from Redis
        if (!result) {
            return NextResponse.json({
                success: true,
                result: null
            })
        }

        return NextResponse.json({
            success: true,
            result: result
        })
    } catch (error) {
        console.error("Error in VGETATTR:", error)
        console.error("Error details:", {
            name: error.name,
            message: error.message,
            stack: error.stack
        })
        return NextResponse.json(
            { success: false, error: (error as Error).message },
            { status: 500 }
        )
    }
}

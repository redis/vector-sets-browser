import { VsetAttrRequestBody } from "@/app/redis-server/api"
import { getRedisUrl, RedisClient } from "@/app/redis-server/server/commands"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
    try {
        const { keyName, element, attributes } = (await request.json()) as VsetAttrRequestBody
        const redisUrl = getRedisUrl()
        if (!redisUrl) {
            return NextResponse.json(
                { success: false, error: "No Redis connection available" },
                { status: 401 }
            )
        }

        const redisResult = await RedisClient.withConnection(
            redisUrl,
            async (client) => {
                const command = ["VSETATTR", keyName, element, attributes]
                return await client.sendCommand(command)
            }
        )

        if (!redisResult.success) {
            return NextResponse.json({
                success: false,
                error: redisResult.error || "Failed to set vector attributes"
            }, { status: 500 })
        }

        const result = redisResult.result

        return NextResponse.json({
            success: true,
            result: result === 1  // Redis returns 1 for success
        })
    } catch (error: unknown) {
        console.error("Error in VSETATTR:", error)
        if (error instanceof Error) {
            console.error("Error details:", {
                name: error.name,
                message: error.message,
                stack: error.stack
            })
        }
        return NextResponse.json(
            { 
                success: false, 
                error: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        )
    }
}

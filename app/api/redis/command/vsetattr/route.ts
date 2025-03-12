import { NextRequest, NextResponse } from "next/server"
import { RedisClient } from "@/app/lib/server/redis-client"
import { VsetAttrRequest } from "@/app/api/types"
import { getRedisUrl } from "@/app/lib/server/redis-client"

export async function POST(request: NextRequest) {
    try {
        const { keyName, element, attributes } = (await request.json()) as VsetAttrRequest
        const url = getRedisUrl()
        if (!url) {
            return NextResponse.json(
                { success: false, error: "No Redis connection available" },
                { status: 401 }
            )
        }

        const redisResult = await RedisClient.withConnection(url, async (client) => {
            const command = ["VSETATTR", keyName, element, attributes]
            console.log(`[vsetattr]`, command)
            return await client.sendCommand(command)
        })

        if (!redisResult.success) {
            return NextResponse.json({
                success: false,
                error: redisResult.error || "Failed to set vector attributes"
            }, { status: 500 })
        }

        const result = redisResult.result
        console.log("[vsetattr] result: ", result)

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

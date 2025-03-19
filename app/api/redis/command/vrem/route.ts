import { VremRequestBody } from "@/app/redis-server/api"
import * as redis from "@/app/redis-server/server/commands"
import { getRedisUrl } from "@/app/redis-server/server/commands"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
    try {
        const body = await request.json() as VremRequestBody
        const { keyName, element } = body

        if (!keyName) {
            return NextResponse.json(
                { success: false, error: "Key name is required" },
                { status: 400 }
            )
        }

        if (!element) {
            return NextResponse.json(
                { success: false, error: "Element is required" },
                { status: 400 }
            )
        }

        const redisUrl = getRedisUrl()
        if (!redisUrl) {
            return NextResponse.json(
                { success: false, error: "No Redis connection available" },
                { status: 401 }
            )
        }

        const result = await redis.vrem(redisUrl, keyName, element)

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            result: result.result
        })
    } catch (error) {
        console.error("Error in VREM API:", error)
        return NextResponse.json(
            { 
                success: false,
                error: error instanceof Error ? error.message : String(error) 
            },
            { status: 500 }
        )
    }
}

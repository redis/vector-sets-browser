import { VinfoRequestBody } from "@/app/redis-server/api"
import * as redis from "@/app/redis-server/server/commands"
import { getRedisUrl } from "@/app/redis-server/server/commands"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as VinfoRequestBody
        const { keyName } = body

        if (!keyName) {
            return NextResponse.json(
                { success: false, error: "Key name is required" },
                { status: 400 }
            )
        }

        const redisUrl = await redis.getRedisUrl()
        if (!redisUrl) {
            return NextResponse.json(
                { success: false, error: "No Redis connection available" },
                { status: 401 }
            )
        }

        const result = await redis.vinfo(redisUrl, keyName)

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            result: result.result,
        })
    } catch (error) {
        console.error("Error in VINFO API:", error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        )
    }
}

// Also support GET requests for compatibility
export async function GET(request: Request) {
    const url = new URL(request.url)
    const keyName = url.searchParams.get("key")

    if (!keyName) {
        return NextResponse.json(
            { success: false, error: "Key parameter is required" },
            { status: 400 }
        )
    }

    const redisUrl = await getRedisUrl()
    if (!redisUrl) {
        return NextResponse.json(
            { success: false, error: "No Redis connection available" },
            { status: 401 }
        )
    }

    try {
        const result = await redis.vinfo(redisUrl, keyName)

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            result: result.result,
        })
    } catch (error) {
        console.error("Error in VINFO API (GET):", error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        )
    }
}

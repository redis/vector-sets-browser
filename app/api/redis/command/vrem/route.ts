import { VremRequestBody } from "@/app/redis-server/api"
import * as redis from "@/app/redis-server/server/commands"
import { getRedisUrl } from "@/app/redis-server/server/commands"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as VremRequestBody
        const { keyName, element, elements } = body

        if (!keyName) {
            return NextResponse.json(
                { success: false, error: "Key name is required" },
                { status: 400 }
            )
        }

        if (!element && !elements) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Element or elements array is required",
                },
                { status: 400 }
            )
        }

        if (element && elements) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Only one of element or elements array should be provided",
                },
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
        let result

        if (element) {
            result = await redis.vrem(redisUrl, keyName, element)
        } else if (elements) {
            result = await redis.vrem_multi(redisUrl, keyName, elements)
        }

        if (result && !result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 500 }
            )
        } else if (result && result.success) {
            return NextResponse.json({
                success: true,
                result: result.result,
            })
        } else {
            return NextResponse.json({
                success: false,
                error: "Unknown error",
            })
        }
    } catch (error) {
        console.error("Error in VREM API:", error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        )
    }
}

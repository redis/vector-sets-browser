import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import * as redis from "@/app/lib/server/redis-client"

// Helper to get Redis URL from cookies
function getRedisUrl(): string | null {
    const url = cookies().get("redis_url")?.value
    return url || null
}

// Type definitions for the request body
interface vremRequestBody {
    keyName: string
    element: string
}

export async function POST(request: Request) {
    try {
        const body = await request.json() as vremRequestBody
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

        const url = getRedisUrl()
        if (!url) {
            return NextResponse.json(
                { success: false, error: "No Redis connection available" },
                { status: 401 }
            )
        }

        const result = await redis.vrem(url, keyName, element)

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

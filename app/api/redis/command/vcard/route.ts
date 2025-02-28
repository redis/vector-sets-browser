import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import * as redis from "@/app/lib/server/redis-client"

// Helper to get Redis URL from cookies
function getRedisUrl(): string | null {
    const cookieStore = cookies()
    return cookieStore.get("redis_url")?.value || null
}

// Type definitions for the request body
interface VcardRequestBody {
    keyName: string
}

export async function POST(request: Request) {
    try {
        const { keyName } = await request.json()

        if (!keyName) {
            return NextResponse.json(
                { success: false, error: "Key name is required" },
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

        const result = await redis.vcard(redisUrl, keyName)

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
        console.error("Error in VCARD API:", error)
        return NextResponse.json(
            { 
                success: false,
                error: error instanceof Error ? error.message : String(error) 
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

    const redisUrl = getRedisUrl()
    if (!redisUrl) {
        return NextResponse.json(
            { success: false, error: "No Redis connection available" },
            { status: 401 }
        )
    }

    try {
        const result = await redis.vcard(redisUrl, keyName)

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
        console.error("Error in VCARD API:", error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        )
    }
}

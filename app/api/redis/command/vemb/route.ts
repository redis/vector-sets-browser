import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import * as redis from "@/app/lib/server/redis-client"

// Helper to get Redis URL from cookies
function getRedisUrl(): string | null {
    const url = cookies().get("redis_url")?.value
    return url || null
}

// Type definitions for the request body
interface VembRequestBody {
    keyName: string
    element?: string
    elements?: string[]
}

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as VembRequestBody
        const { keyName, element, elements } = body

        if (!keyName || (!element && !elements)) {
            return NextResponse.json(
                { success: false, error: "Key name and element(s) are required" },
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

        // Handle single element case
        if (element) {
            const result = await redis.vemb(url, keyName, element)
            return NextResponse.json({ success: true, result: result })
        }

        // Handle multiple elements case
        if (elements) {
            const promises = elements.map(el => redis.vemb(url, keyName, el))
            const results = await Promise.all(promises)
            return NextResponse.json({ success: true, result: results })
        }

        return NextResponse.json(
            { success: false, error: "Invalid request format" },
            { status: 400 }
        )
    } catch (error) {
        console.error("Error in VEMB route:", error)
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        )
    }
}

// Also support GET requests for compatibility
export async function GET(request: Request) {
    const url = new URL(request.url)
    const keyName = url.searchParams.get('key')
    const element = url.searchParams.get('element')
    
    if (!keyName) {
        return NextResponse.json(
            { success: false, error: "Key parameter is required" },
            { status: 400 }
        )
    }
    
    if (!element) {
        return NextResponse.json(
            { success: false, error: "Element parameter is required" },
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
        const result = await redis.vemb(redisUrl, keyName, element)
        
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
        console.error("Error in VEMB API (GET):", error)
        return NextResponse.json(
            { 
                success: false,
                error: error instanceof Error ? error.message : String(error) 
            },
            { status: 500 }
        )
    }
} 
import { VembRequestBody } from "@/app/redis-server/api"
import * as redis from "@/app/redis-server/server/commands"
import { NextResponse } from "next/server"

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

        const redisUrl = await redis.getRedisUrl()
        if (!redisUrl) {
            return NextResponse.json(
                { success: false, error: "No Redis connection available" },
                { status: 401 }
            )
        }

        // Handle single element case
        if (element) {
            const result = await redis.vemb(redisUrl, keyName, element)
            return NextResponse.json(result)
        }

        // Handle multiple elements case
        if (elements) {
            const promises = elements.map((el) =>
                redis.vemb(redisUrl, keyName, el)
            )
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
    
    const redisUrl = await redis.getRedisUrl()
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
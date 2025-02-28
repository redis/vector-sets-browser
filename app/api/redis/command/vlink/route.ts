import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import * as redis from "@/app/lib/server/redis-client"

// Helper to get Redis URL from cookies
function getRedisUrl(): string | null {
    const url = cookies().get("redis_url")?.value
    return url || null
}

// Type definitions for the request body
interface VlinkRequestBody {
    keyName: string
    element: string
    count?: number
}

export async function POST(request: Request) {
    try {
        const body = await request.json() as VlinkRequestBody
        const { keyName, element, count = 10 } = body

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

        // Call the Redis client function with withscores=true
        const result = await redis.vlink(url, keyName, element, count)

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 500 }
            )
        }

        // Process the result to ensure it's in the expected format
        const links = result.result || []
        
        // Return the links as an array of [element, score] tuples
        return NextResponse.json({
            success: true,
            result: links
        })
    } catch (error) {
        console.error("Error in VLINK API:", error)
        return NextResponse.json(
            { 
                success: false,
                error: error instanceof Error ? error.message : String(error) 
            },
            { status: 500 }
        )
    }
}

// Also support GET requests for compatibility with existing code
export async function GET(request: Request) {
    const url = new URL(request.url)
    const node = url.searchParams.get('node')
    const withscores = url.searchParams.get('withscores') === '1'
    const count = parseInt(url.searchParams.get('count') || '10', 10)
    
    if (!node) {
        return NextResponse.json(
            { success: false, error: "Node parameter is required" },
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
        // Extract key name and element from the node parameter
        // Assuming format is "keyName:element"
        const [keyName, element] = node.split(':')
        
        if (!keyName || !element) {
            return NextResponse.json(
                { success: false, error: "Invalid node format. Expected 'keyName:element'" },
                { status: 400 }
            )
        }
        
        const result = await redis.vlink(redisUrl, keyName, element, count)
        
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
        console.error("Error in VLINK API (GET):", error)
        return NextResponse.json(
            { 
                success: false,
                error: error instanceof Error ? error.message : String(error) 
            },
            { status: 500 }
        )
    }
} 
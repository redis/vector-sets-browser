import * as redis from "@/app/redis-server/server/commands"
import { getRedisUrl } from "@/app/redis-server/server/commands"
import { NextResponse } from "next/server"

// GET /api/vectorset - List all vector sets (scanVectorSets)
export async function GET() {
    const redisUrl = await getRedisUrl()
    if (!redisUrl) {
        return NextResponse.json(
            { success: false, error: "No Redis connection available" },
            { status: 401 }
        )
    }
    
    try {
        const result = await redis.scanVectorSets(redisUrl)
        
        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 500 }
            )
        }
        return NextResponse.json(result)
    } catch (error) {
        console.error("Error in scanVectorSets API (GET):", error)
        return NextResponse.json(
            { 
                success: false,
                error: error instanceof Error ? error.message : String(error) 
            },
            { status: 500 }
        )
    }
} 
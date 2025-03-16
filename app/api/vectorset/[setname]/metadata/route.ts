import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import * as redis from "@/app/lib/server/redis-client"
import { VectorSetMetadata } from "@/app/types/embedding"

// Helper to get Redis URL from cookies
function getRedisUrl(): string | null {
    const url = cookies().get("redis_url")?.value
    return url || null
}

// Type definitions for the request body
interface SetMetadataRequestBody {
    metadata: VectorSetMetadata
}

// GET /api/vectorset/[setname]/metadata - Get metadata for a vector set
export async function GET(
    request: NextRequest,
    { params }: { params: { setname: string } }
) {
    try {
        console.log("GET /api/vectorset/[setname]/metadata")
        const keyName = params.setname
        
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
        
        const result = await redis.getMetadata(redisUrl, keyName)
        
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
        console.error("Error in getMetadata API (GET):", error)
        return NextResponse.json(
            { 
                success: false,
                error: error instanceof Error ? error.message : String(error) 
            },
            { status: 500 }
        )
    }
}

// PUT /api/vectorset/[setname]/metadata - Set metadata for a vector set
export async function PUT(
    request: NextRequest,
    { params }: { params: { setname: string } }
) {
    try {
        const keyName = params.setname
        const body = await request.json() as SetMetadataRequestBody
        const { metadata } = body

        if (!keyName) {
            return NextResponse.json(
                { success: false, error: "Key name is required" },
                { status: 400 }
            )
        }

        if (!metadata) {
            return NextResponse.json(
                { success: false, error: "Metadata is required" },
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

        const result = await redis.setMetadata(url, keyName, metadata)

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
        console.error("Error in setMetadata API (PUT):", error)
        return NextResponse.json(
            { 
                success: false,
                error: error instanceof Error ? error.message : String(error) 
            },
            { status: 500 }
        )
    }
}

// Also support POST for backward compatibility
export async function POST(
    request: NextRequest,
    { params }: { params: { setname: string } }
) {
    return PUT(request, { params })
} 
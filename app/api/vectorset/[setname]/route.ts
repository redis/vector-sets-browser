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
interface CreateVectorSetRequestBody {
    dimensions: number
    metadata?: VectorSetMetadata
    customData?: { element: string; vector: number[] }
}

// POST /api/vectorset/[setname] - Create a new vector set
export async function POST(
    request: NextRequest,
    { params }: { params: { setname: string } }
) {
    try {
        const keyName = params.setname
        const body = await request.json() as CreateVectorSetRequestBody
        const { dimensions, metadata, customData } = body

        if (!keyName) {
            return NextResponse.json(
                { success: false, error: "Key name is required" },
                { status: 400 }
            )
        }

        if (dimensions === undefined || dimensions < 2) {
            return NextResponse.json(
                { success: false, error: "Valid dimensions (>= 2) are required" },
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

        const result = await redis.createVectorSet(url, keyName, dimensions, metadata, customData)

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
        console.error("Error in createVectorSet API:", error)
        return NextResponse.json(
            { 
                success: false,
                error: error instanceof Error ? error.message : String(error) 
            },
            { status: 500 }
        )
    }
}

// DELETE /api/vectorset/[setname] - Delete a vector set
export async function DELETE(
    request: NextRequest,
    { params }: { params: { setname: string } }
) {
    try {
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
        
        const result = await redis.deleteVectorSet(redisUrl, keyName)
        
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
        console.error("Error in deleteVectorSet API (DELETE):", error)
        return NextResponse.json(
            { 
                success: false,
                error: error instanceof Error ? error.message : String(error) 
            },
            { status: 500 }
        )
    }
} 
import { SetMetadataRequestBody } from "@/app/api/vector-sets"
import * as redis from "@/app/redis-server/server/commands"
import { getRedisUrl } from "@/app/redis-server/server/commands"
import { NextRequest, NextResponse } from "next/server"

// GET /api/vectorset/[setname]/metadata - Get metadata for a vector set
export async function GET(
    request: NextRequest,
    { params }: { params: { setname: string } }
) {
    try {        
        const parsedParams = await params;
        
        if (!parsedParams || !parsedParams.setname) {
            console.error("Missing setname parameter:", parsedParams)
            return NextResponse.json(
                { success: false, error: "Key name is required" },
                { status: 400 }
            )
        }
        
        const keyName = parsedParams.setname
        
        const redisUrl = await getRedisUrl()
        if (!redisUrl) {
            return NextResponse.json(
                { success: false, error: "No Redis connection available" },
                { status: 401 }
            )
        }
        
        const response = await redis.getMetadata(redisUrl, keyName)
        console.log("getMetadata returned", response)
        if (!response.success) {
            return NextResponse.json(
                { success: false, error: response.error },
                { status: 500 }
            )
        }
        
        return NextResponse.json({
            success: true,
            result: response.result
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
        console.log("PUT /api/vectorset/[setname]/metadata", params)
        
        const parsedParams = params;
        
        if (!parsedParams || !parsedParams.setname) {
            console.error("Missing setname parameter:", parsedParams)
            return NextResponse.json(
                { success: false, error: "Key name is required" },
                { status: 400 }
            )
        }
        
        const keyName = parsedParams.setname
        const body = await request.json() as SetMetadataRequestBody
        const { metadata } = body

        if (!metadata) {
            return NextResponse.json(
                { success: false, error: "Metadata is required" },
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

        const result = await redis.setMetadata(redisUrl, keyName, metadata)

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
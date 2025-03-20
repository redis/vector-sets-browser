import { NextResponse } from "next/server"
import { getRedisUrl, vadd_multi } from "@/app/redis-server/server/commands"
import { VaddMultiRequestBody } from "@/app/redis-server/api"

export async function POST(request: Request) {
    try {
        // Get Redis URL from cookies
        const redisUrl = getRedisUrl()
        if (!redisUrl) {
            return NextResponse.json(
                { success: false, error: "Redis URL not found in cookies" },
                { status: 401 }
            )
        }

        // Parse the request body
        const body = await request.json() as VaddMultiRequestBody
        
        // Validate input
        if (!body.keyName) {
            return NextResponse.json(
                { success: false, error: "Key name is required" },
                { status: 400 }
            )
        }

        if (!body.elements || !Array.isArray(body.elements) || body.elements.length === 0) {
            return NextResponse.json(
                { success: false, error: "Elements array is required and must not be empty" },
                { status: 400 }
            )
        }

        if (!body.vectors || !Array.isArray(body.vectors) || body.vectors.length === 0) {
            return NextResponse.json(
                { success: false, error: "Vectors array is required and must not be empty" },
                { status: 400 }
            )
        }

        if (body.elements.length !== body.vectors.length) {
            return NextResponse.json(
                { success: false, error: `Mismatch between elements (${body.elements.length}) and vectors (${body.vectors.length})` },
                { status: 400 }
            )
        }

        // Execute VADD_MULTI command
        const result = await vadd_multi(
            redisUrl,
            body.keyName,
            body.elements,
            body.vectors,
            body.attributes,
            body.useCAS,
            body.reduceDimensions
        )

        // If the operation failed, return the error with an appropriate status code
        if (!result.success) {
            return NextResponse.json({
                success: false,
                error: result.error || "Failed to add vectors in bulk"
            }, { status: 400 })
        }

        return NextResponse.json({
            success: true,
            result: result.result
        })
    } catch (error) {
        console.error("Error in VADD_MULTI API:", error)
        return NextResponse.json(
            { 
                success: false,
                error: error instanceof Error ? error.message : String(error) 
            },
            { status: 500 }
        )
    }
} 
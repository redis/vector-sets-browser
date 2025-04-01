import { VaddMultiRequestBody } from "@/app/redis-server/api"
import * as redis from "@/app/redis-server/server/commands"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
    try {
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

        const redisUrl = await redis.getRedisUrl()
        if (!redisUrl) {
            return NextResponse.json(
                { success: false, error: "No Redis connection available" },
                { status: 401 }
            )
        }

        const result = await redis.vadd_multi(redisUrl, body)

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
import { VaddRequestBody } from "@/app/redis-server/api"
import * as redis from "@/app/redis-server/server/commands"
import { validateVector } from "@/app/embeddings/utils/validation"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
    try {
        const body = await request.json() as VaddRequestBody
        const { keyName, element, vector } = body

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

        // Validate the vector
        const validationResult = validateVector(vector)
        if (!validationResult.isValid) {
            return NextResponse.json(
                { success: false, error: `Invalid vector data: ${validationResult.error}` },
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

        // Use the original vector, not the one from validationResult
        const result = await redis.vadd(redisUrl, body)

        // If the operation failed, return the error with an appropriate status code
        if (!result.success) {
            return NextResponse.json({
                success: false,
                error: result.error || "Failed to add vector"
            }, { status: 400 })
        }

        return NextResponse.json({
            success: true,
            result: result.result,
            executedCommand: result.executedCommand
        })
    } catch (error) {
        console.error("Error in VADD API:", error)
        return NextResponse.json(
            { 
                success: false,
                error: error instanceof Error ? error.message : String(error) 
            },
            { status: 500 }
        )
    }
} 
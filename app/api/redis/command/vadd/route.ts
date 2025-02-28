import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import * as redis from "@/app/lib/server/redis-client"
import { validateAndNormalizeVector } from "@/app/utils/vectorValidation"

// Helper to get Redis URL from cookies
function getRedisUrl(): string | null {
    const url = cookies().get("redis_url")?.value
    return url || null
}

// Type definitions for the request body
interface VaddRequestBody {
    keyName: string
    element: string
    vector: number[]
}

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

        if (!vector || !Array.isArray(vector)) {
            return NextResponse.json(
                { success: false, error: "Vector must be an array" },
                { status: 400 }
            )
        }

        // Validate and normalize the vector
        const validationResult = validateAndNormalizeVector(vector, "unknown")
        if (!validationResult.isValid) {
            return NextResponse.json(
                { success: false, error: `Invalid vector data: ${validationResult.error}` },
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

        const result = await redis.vadd(url, keyName, element, validationResult.vector)

        return NextResponse.json({
            success: result.success,
            result: result.result,
            error: result.error
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
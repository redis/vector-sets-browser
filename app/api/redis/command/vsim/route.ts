import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import * as redis from "@/app/lib/server/redis-client"

// Helper to get Redis URL from cookies
function getRedisUrl(): string | null {
    const url = cookies().get("redis_url")?.value
    return url || null
}

// Type definitions for the request body
interface VsimRequestBody {
    keyName: string
    searchVector?: number[]
    searchElement?: string
    count: number
    withEmbeddings?: boolean
    filter?: string
}

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as VsimRequestBody
        const { keyName, searchVector, searchElement, count, withEmbeddings = false, filter = "" } = body

        if (!keyName || (!searchVector && !searchElement)) {
            return NextResponse.json(
                { success: false, error: "Key name and either searchVector or searchElement are required" },
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

        const params = {
            searchVector,
            searchElement,
            count: count || 10,
            filter
        }

        const data = await redis.vsim(url, keyName, params)

        if (!data.success) {
            return NextResponse.json(
                { success: false, error: data.error },
                { status: 500 }
            )
        }
        // Validate the result format
        if (!Array.isArray(data.result.result)) {
            console.error("Expected array result from Redis, got:", typeof data.result.result)
            return NextResponse.json({
                success: false,
                error: "Invalid response format from Redis"
            }, { status: 500 })
        }
        //console.log("[vsim] data.result.result: ", data.result.result)

        // Type assertion for the result array
        let validResults = data.result.result as [string, number, number[]][]

        // If embeddings are requested, fetch them
        if (withEmbeddings && validResults.length > 0) {
            const embeddingsPromises = validResults.map(async ([id, score]) => {
                const embResult = await redis.vemb(url, keyName, id)
                return [id, score, embResult.success ? embResult.result.result : []] as [string, number, number[]]
            })

            validResults = await Promise.all(embeddingsPromises)
            //console.log("[vsim] validResults (with embeddings): ", validResults)
        } else { 
            //console.log("[vsim] validResults (without embeddings): ", validResults)
        }

        return NextResponse.json({
            success: true,
            result: validResults,
            executionTimeMs: data.result.executionTimeMs
        })
    } catch (error) {
        console.error("Error in VSIM route:", error)
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        )
    }
} 
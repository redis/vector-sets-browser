import { VsimRequestBody } from "@/app/redis-server/api"
import * as redis from "@/app/redis-server/server/commands"
import { getRedisUrl } from "@/app/redis-server/server/commands"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as VsimRequestBody
        const { 
            keyName, 
            searchVector, 
            searchElement, 
            count, 
            withEmbeddings = false, 
            filter = "",
            expansionFactor 
        } = body

        if (!keyName || (!searchVector && !searchElement)) {
            return NextResponse.json(
                { success: false, error: "Key name and either searchVector or searchElement are required" },
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

        const params = {
            searchVector,
            searchElement,
            count: count || 10,
            filter,
            expansionFactor
        }

        const response = await redis.vsim(redisUrl, keyName, params)

        if (!response.success) {
            return NextResponse.json(
                { success: false, error: response.error },
                { status: 500 }
            )
        }
        // Validate the result format
        if (!Array.isArray(response.result.result)) {
            console.error(
                "Expected array result from Redis, got:",
                typeof response.result.result
            )
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid response format from Redis",
                },
                { status: 500 }
            )
        }

        // Type assertion for the result array
        let validResults = response.result.result as [
            string,
            number,
            number[]
        ][]

        // If embeddings are requested, fetch them
        if (withEmbeddings && validResults.length > 0) {
            const embeddingsPromises = validResults.map(async ([id, score]) => {
                const embResult = await redis.vemb(redisUrl, keyName, id)
                return [id, score, embResult.success ? embResult.result.result : []] as [string, number, number[]]
            })

            validResults = await Promise.all(embeddingsPromises)
        }
        return NextResponse.json({
            success: true,
            result: validResults,
            executionTimeMs: response.result.executionTimeMs,
            executedCommand: response.result.executedCommand,
        })
    } catch (error) {
        console.error("Error in VSIM route:", error)
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        )
    }
} 
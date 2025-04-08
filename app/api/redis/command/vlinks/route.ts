import { NextResponse } from "next/server"
import {
    RedisConnection,
    getRedisUrl,
} from "@/app/redis-server/RedisConnection"
import { buildVlinksCommand, validateVlinksRequest } from "./command"
import { validateRequest } from "@/app/redis-server/utils"
import { fetchEmbeddingsBatch } from "@/app/api/redis/command/vemb_multi/command"

// Define the types for our links
type LinkTuple = [string, number];
type LinkTupleWithEmb = [string, number, number[] | null];
type ProcessedResult = LinkTuple[][];
type ProcessedResultWithEmb = LinkTupleWithEmb[][];

export async function POST(request: Request) {
    try {
        const validatedRequest = await validateRequest(
            request,
            validateVlinksRequest
        )
        console.log("Received VLINKS request")

        const redisUrl = await getRedisUrl()
        if (!redisUrl) {
            return NextResponse.json(
                { success: false, error: "No Redis connection available" },
                { status: 401 }
            )
        }

        const command = buildVlinksCommand(validatedRequest)

        if (validatedRequest.returnCommandOnly) {
            return NextResponse.json({
                success: true,
                executedCommand: command.join(" ")
            })
        }

        const { keyName, element, withEmbeddings } = validatedRequest

        if (!keyName || !element) {
            return NextResponse.json(
                { success: false, error: "Key name and element are required" },
                { status: 400 }
            )
        }

        const response = await RedisConnection.withClient(
            redisUrl,
            async (client) => {
                try {
                    const result = await client.sendCommand(command)

                    if (!result || !Array.isArray(result)) {
                        console.error("Invalid VLINKS result:", result)
                        throw new Error(
                            `Failed to get links for element ${element}`
                        )
                    }

                    // Process the result - it's an array of arrays, where each sub-array
                    // represents the neighbors at one level
                    const processedResult: ProcessedResult = []

                    for (let i = 0; i < result.length; i++) {
                        const levelLinks = result[i]
                        if (!Array.isArray(levelLinks)) {
                            console.warn(
                                `Invalid level links at index ${i}:`,
                                levelLinks
                            )
                            continue
                        }

                        // Each level is a map of element -> score
                        const levelTuples: LinkTuple[] = []
                        for (let j = 0; j < levelLinks.length; j += 2) {
                            const neighbor = levelLinks[j]
                            const score = levelLinks[j + 1]

                            if (!neighbor || !score) {
                                console.warn(
                                    `Invalid neighbor/score pair at level ${i}, index ${j}:`,
                                    { neighbor, score }
                                )
                                continue
                            }

                            const numScore = parseFloat(String(score))
                            if (isNaN(numScore)) {
                                console.warn(
                                    `Invalid score for neighbor ${neighbor}:`,
                                    score
                                )
                                continue
                            }

                            levelTuples.push([String(neighbor), numScore])
                        }

                        processedResult.push(levelTuples)
                    }
                    return processedResult
                } catch (error) {
                    console.error("VLINKS operation error:", error)
                    throw new Error(
                        `Failed to get links for element ${element}: ${error}`
                    )
                }
            }
        )

        if (!response.success || !response.result) {
            return NextResponse.json(
                { success: false, error: response.error || "No result returned" },
                { status: 500 }
            )
        }

        let links: ProcessedResult | ProcessedResultWithEmb = response.result
        if (withEmbeddings && links) {
            // Collect all unique IDs across all levels
            console.log("GET embeddings")
            const allIds = Array.from(
                new Set(links.flatMap((level) => level.map(([id]) => id)))
            )

            const embResults = await fetchEmbeddingsBatch(redisUrl, keyName, allIds)

            if (embResults.success && embResults.result) {
                // Create a map of id -> embedding for quick lookup
                const embeddingMap = new Map(
                    allIds.map((id, index) => [id, embResults.result![index]])
                )

                // Process each level using the map
                links = links.map((level) =>
                    level.map(
                        ([id, score]): LinkTupleWithEmb => [String(id), parseFloat(String(score)), embeddingMap.get(id) || null]
                    )
                )
            }
        }

        return NextResponse.json({
            success: true,
            result: links,
        })
    } catch (error) {
        console.error("Error in VLINKS API:", error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        )
    }
}

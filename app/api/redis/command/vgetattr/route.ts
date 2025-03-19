import { VgetAttrRequestBody } from "@/app/redis-server/api"
import {
    getRedisUrl,
    RedisClient,
    VectorOperationResult,
} from "@/app/redis-server/server/commands"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
    try {
        const { keyName, element, elements } =
            (await request.json()) as VgetAttrRequestBody

        const redisUrl = getRedisUrl()
        if (!redisUrl) {
            return NextResponse.json(
                { success: false, error: "No Redis connection available" },
                { status: 401 }
            )
        }
        let redisResult: VectorOperationResult
        
        if (elements) {
            // Multiple elements
            redisResult = await RedisClient.withConnection(
                redisUrl,
                async (client) => {
                    const pipeline = client.multi()
                    for (const element of elements) {
                        const command = ["VGETATTR", keyName, element]
                        pipeline.addCommand(command)
                    }
                    return await pipeline.exec()
                }
            )

            if (!redisResult.success) {
                return NextResponse.json(
                    {
                        success: false,
                        error:
                            redisResult.error ||
                            "Failed to get vector attributes",
                    },
                    { status: 500 }
                )
            }
            const result = redisResult.result.map((el: VectorOperationResult) => el)

            // Handle null/empty response from Redis
            if (!result) {
                return NextResponse.json({
                    success: true,
                    result: null,
                })
            }

            return NextResponse.json({
                success: true,
                result: result,
            })
        } else if (element) {
            // Single element
            redisResult = await RedisClient.withConnection(
                redisUrl,
                async (client) => {
                    const command = ["VGETATTR", keyName, element]
                    return await client.sendCommand(command)
                }
            )
            if (!redisResult.success) {
                return NextResponse.json(
                    {
                        success: false,
                        error:
                            redisResult.error ||
                            "Failed to get vector attributes",
                    },
                    { status: 500 }
                )
            }

            const result = redisResult.result

            // Handle null/empty response from Redis
            if (!result) {
                return NextResponse.json({
                    success: true,
                    result: null,
                })
            }

            return NextResponse.json({
                success: true,
                result: result,
            })
        } else {
            return NextResponse.json(
                {
                    success: false,
                    error: "No element or elements provided",
                },
                { status: 400 }
            )
        }
    } catch (error) {
        console.error("Error in VGETATTR:", error)
        return NextResponse.json(
            { success: false, error: (error as Error).message },
            { status: 500 }
        )
    }
}

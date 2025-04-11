import { SetMetadataRequestBody } from "@/app/api/vector-sets"
import {
    RedisConnection,
    getRedisUrl,
} from "@/app/redis-server/RedisConnection"
import { NextRequest, NextResponse } from "next/server"

// type Params = { params: { setname: string } }

// GET /api/vectorset/[setname]/metadata - Get metadata for a vector set
export async function GET(
    _request: NextRequest,
    { params }: any
) {
    try {
        const parsedParams = await params

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

        const response = await RedisConnection.withClient(
            redisUrl,
            async (client) => {
                const configKey = "vector-set-browser:config"
                const hashKey = `vset:${keyName}:metadata`

                const storedData = await client.hGet(configKey, hashKey)

                try {
                    // Parse the stored data
                    const parsedData = storedData
                        ? JSON.parse(storedData)
                        : null

                    // If the metadata needed correction, write it back to Redis
                    if (
                        parsedData &&
                        JSON.stringify(parsedData) !==
                        JSON.stringify(parsedData)
                    ) {
                        await client.hSet(configKey, {
                            [hashKey]: JSON.stringify(parsedData),
                        })
                    }
                    return parsedData
                } catch (error) {
                    console.error(
                        `Error processing metadata for ${keyName}:`,
                        error
                    )
                    throw error
                }
            }
        )

        if (!response || !response.success) {
            return NextResponse.json(
                { success: false, error: "Error calling getMetadata" },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            result: response.result,
        })
    } catch (error) {
        console.error("Error in getMetadata API (GET):", error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        )
    }
}

// PUT /api/vectorset/[setname]/metadata - Set metadata for a vector set
export async function PUT(
    request: NextRequest,
    { params }: any
) {
    try {
        const parsedParams = await params

        if (!parsedParams || !parsedParams.setname) {
            console.error("Missing setname parameter:", parsedParams)
            return NextResponse.json(
                { success: false, error: "Key name is required" },
                { status: 400 }
            )
        }

        const keyName = parsedParams.setname
        const body = (await request.json()) as SetMetadataRequestBody
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

        const response = await RedisConnection.withClient(
            redisUrl,
            async (client) => {
                const configKey = "vector-set-browser:config"
                const hashKey = `vset:${keyName}:metadata`
                await client.hSet(configKey, {
                    [hashKey]: JSON.stringify(metadata),
                })
                return true
            }
        )

        if (!response.success) {
            return NextResponse.json(
                { success: false, error: response.error },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            result: response.result,
        })
    } catch (error) {
        console.error("Error in setMetadata API (PUT):", error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        )
    }
}

// Also support POST for backward compatibility
export async function POST(
    request: NextRequest,
    { params }: any
) {
    return PUT(request, { params })
}

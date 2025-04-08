import { VectorSetCreateRequestBody } from "@/app/api/vector-sets"
import { EmbeddingService } from "@/app/embeddings/service"
import { getExpectedDimensions } from "@/app/embeddings/types/embeddingModels"
import {
    RedisConnection,
    getRedisUrl,
} from "@/app/redis-server/RedisConnection"
import { NextRequest, NextResponse } from "next/server"

// POST /api/vectorset/[setname] - Create a new vector set
export async function POST(
    request: NextRequest,
    { params }: any //{ params: { setname: string } }
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
        const body = (await request.json()) as VectorSetCreateRequestBody
        const { dimensions, metadata, customData } = body

        if (dimensions === undefined || dimensions < 2) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Valid dimensions (>= 2) are required",
                },
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
                // Check if key already exists
                const exists = await client.sendCommand(["EXISTS", keyName])
                if (exists) {
                    throw new Error("Vector set already exists")
                }

                let effectiveDimensions = dimensions

                // If dimensions is not specified or zero, try to determine from metadata and/or embedding service
                if (!dimensions || dimensions < 2) {
                    // First, try to get dimensions from metadata directly
                    if (metadata?.dimensions && metadata.dimensions >= 2) {
                        effectiveDimensions = metadata.dimensions
                        console.log(
                            `Using dimensions from metadata: ${effectiveDimensions}`
                        )
                    }
                    // If not available in metadata, try to determine from embedding configuration
                    else if (metadata?.embedding) {
                        try {
                            // Try to get expected dimensions from config
                            const expectedDimensions = getExpectedDimensions(
                                metadata.embedding
                            )

                            if (expectedDimensions >= 2) {
                                effectiveDimensions = expectedDimensions
                                console.log(
                                    `Using dimensions from config: ${effectiveDimensions}`
                                )
                            } else {
                                // If can't determine from config, use EmbeddingService to get a test embedding
                                const embeddingService = new EmbeddingService()
                                console.log(
                                    "Getting dimensions from EmbeddingService"
                                )
                                console.log(
                                    "metadata.embedding",
                                    metadata.embedding
                                )

                                // Get a test embedding to determine dimensions
                                const testEmbedding =
                                    await embeddingService.getEmbedding(
                                        "test",
                                        metadata.embedding
                                    )
                                effectiveDimensions = testEmbedding.length
                                console.log(
                                    `Determined dimensions using test embedding: ${effectiveDimensions}`
                                )
                            }
                        } catch (error) {
                            throw new Error(
                                `Failed to determine vector dimensions: ${
                                    error instanceof Error
                                        ? error.message
                                        : String(error)
                                }`
                            )
                        }
                    } else {
                        throw new Error("Dimensions must be at least 2")
                    }
                }

                // Create the vector set with either the custom vector or a dummy vector
                const vector =
                    customData?.vector || Array(effectiveDimensions).fill(0)
                const element = customData?.element || "First Vector (Default)"

                // Ensure vector is an array of numbers
                if (!Array.isArray(vector)) {
                    throw new Error(`Invalid vector data: not an array`)
                }

                if (vector.some((v) => typeof v !== "number" || isNaN(v))) {
                    throw new Error(
                        `Invalid vector data: contains non-numeric values`
                    )
                }

                // Validate vector dimensions
                if (vector.length !== effectiveDimensions) {
                    throw new Error(
                        `Vector dimensions (${vector.length}) do not match specified dimensions (${effectiveDimensions})`
                    )
                }

                // Create the vector set
                const command = ["VADD", keyName]

                // Add REDUCE flag if dimension reduction is configured
                if (metadata?.redisConfig?.reduceDimensions) {
                    command.push(
                        "REDUCE",
                        metadata.redisConfig.reduceDimensions.toString()
                    )
                }

                // Add VALUES and vector data
                command.push(
                    "VALUES",
                    effectiveDimensions.toString(),
                    ...vector.map((v) => v.toString()),
                    element
                )

                // Add CAS flag if enabled
                if (metadata?.redisConfig?.defaultCAS) {
                    command.push("CAS")
                }

                // Add quantization flag
                if (metadata?.redisConfig?.quantization) {
                    command.push(metadata.redisConfig.quantization)
                }

                // Add build exploration factor if configured
                if (metadata?.redisConfig?.buildExplorationFactor) {
                    command.push(
                        "EF",
                        metadata.redisConfig.buildExplorationFactor.toString()
                    )
                }

                try {
                    await client.sendCommand(command)

                    // Store metadata if provided
                    if (metadata) {
                        const configKey = "vector-set-browser:config"
                        const hashKey = `vset:${keyName}:metadata`
                        await client.hSet(configKey, {
                            [hashKey]: JSON.stringify(metadata),
                        })
                    }

                    return "created"
                } catch (error) {
                    console.error("Error executing VADD command:", error)
                    throw new Error(
                        `Failed to create vector set: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`
                    )
                }
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
        console.error("Error in createVectorSet API:", error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        )
    }
}

// DELETE /api/vectorset/[setname] - Delete a vector set
export async function DELETE(
    _request: NextRequest,
    { params }: any //{ params: { setname: string } }
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
                // Delete the key
                const deleteResult = (await client.sendCommand([
                    "DEL",
                    keyName,
                ])) as number

                if (deleteResult === 0) {
                    throw new Error(`Failed to delete vector set '${keyName}'`)
                }

                // Also delete metadata from the consolidated config
                const configKey = "vector-set-browser:config"
                const hashKey = `vset:${keyName}:metadata`
                
                await client.hDel(configKey, hashKey)

                return "deleted"
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
        console.error("Error in deleteVectorSet API (DELETE):", error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        )
    }
}

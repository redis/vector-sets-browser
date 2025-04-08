import { VectorSetCreateRequestBody } from "@/app/api/vector-sets"
import * as redis from "@/app/redis-server/server/commands"
import { getRedisUrl } from "@/app/redis-server/server/commands"
import { NextRequest, NextResponse } from "next/server"

// POST /api/vectorset/[setname] - Create a new vector set
export async function POST(
    request: NextRequest,
    { params }: any //{ params: { setname: string } }
) {
    try {
        console.log("POST /api/vectorset/[setname]", params)

        const parsedParams = await params;

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

        const result = await redis.createVectorSet(
            redisUrl,
            keyName,
            dimensions,
            metadata,
            customData
        )

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            result: result.result,
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
        console.log("DELETE /api/vectorset/[setname]", params)

        const parsedParams = await params;

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

        const result = await redis.deleteVectorSet(redisUrl, keyName)

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            result: result.result,
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

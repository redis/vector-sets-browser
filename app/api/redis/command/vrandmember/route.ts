import { NextResponse } from "next/server"
import {
    RedisConnection,
    getRedisUrl,
} from "@/lib/redis-server/RedisConnection"
import { validateRequest } from "@/lib/redis-server/utils"
import { validateVrandMemberRequest, buildVrandMemberCommand } from "./command"

export async function POST(request: Request) {
    try {
        const validatedRequest = await validateRequest(
            request,
            validateVrandMemberRequest
        )
        console.log("Received VRANDMEMBER request")

        const redisUrl = await getRedisUrl()
        if (!redisUrl) {
            return NextResponse.json(
                { success: false, error: "No Redis connection available" },
                { status: 401 }
            )
        }

        const command = buildVrandMemberCommand(validatedRequest)
        const commandStr = command.join(" ")

        if (validatedRequest.returnCommandOnly) {
            return NextResponse.json({
                success: true,
                executedCommand: commandStr,
            })
        }

        const response = await RedisConnection.withClient(
            redisUrl,
            async (client) => {
                return await client.sendCommand(command)
            }
        )

        if (
            !response.success ||
            !response.result ||
            !Array.isArray(response.result)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error: response.error || "Invalid response format",
                },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            result: response.result,
        })
    } catch (error) {
        console.error("Error in VRANDMEMBER route:", error)
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        )
    }
}

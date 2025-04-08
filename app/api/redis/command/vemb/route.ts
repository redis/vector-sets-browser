import { NextResponse } from "next/server"
import { RedisConnection, getRedisUrl } from "@/app/redis-server/RedisConnection"
import { validateRequest } from '@/app/redis-server/utils'
import { validateVembRequest, buildVembCommand } from "./command"

export async function POST(request: Request) {
    try {
        const validatedRequest = await validateRequest(
            request,
            validateVembRequest
        )
        console.log("Received VEMB request")

        const redisUrl = await getRedisUrl()
        if (!redisUrl) {
            return NextResponse.json(
                { success: false, error: "No Redis connection available" },
                { status: 401 }
            )
        }

        const command = buildVembCommand(validatedRequest)
        const commandStr = command.join(' ')

        if (validatedRequest.returnCommandOnly) {
            return NextResponse.json({
                success: true,
                executedCommand: commandStr
            })
        }

        const response = await RedisConnection.withClient(redisUrl, async (client) => {
            return await client.sendCommand(command)
        })

        if (!response.success || !response.result || !Array.isArray(response.result)) {
            return NextResponse.json(
                { success: false, error: response.error || "Invalid response format" },
                { status: 500 }
            )
        }

        // Convert vector values to floats
        const vector = (response.result as (string | number)[]).map((val: string | number) => parseFloat(String(val)))

        return NextResponse.json({
            success: true,
            result: vector
        })
    } catch (error) {
        console.error("Error in VEMB route:", error)
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        )
    }
}


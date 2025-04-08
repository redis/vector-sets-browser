import { RedisConnection, getRedisUrl } from '@/app/redis-server/RedisConnection'
import { validateRequest, formatResponse, handleError } from '@/app/redis-server/utils'
import { validateVinfoRequest, buildVinfoCommand } from './command'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        // Validate request
        const validatedRequest = await validateRequest(request, validateVinfoRequest)
        console.log("Received VINFO request")
        
        // Get Redis URL
        const redisUrl = await getRedisUrl()
        if (!redisUrl) {
            return NextResponse.json(
                { success: false, error: 'No Redis connection available' },
                { status: 401 }
            )
        }

        // Build command
        const commands = buildVinfoCommand(validatedRequest)
        const commandStr = commands[0].join(' ')

        // If returnCommandOnly is true, return just the command
        if (validatedRequest.returnCommandOnly) {
            return NextResponse.json({
                success: true,
                executedCommand: commandStr
            })
        }

        // Execute command
        const redisResult = await RedisConnection.withClient(redisUrl, async (client) => {
            return await client.sendCommand(commands[0])
        })

        // Check if the Redis operation itself failed
        if (!redisResult.success) {
            return formatResponse(redisResult)
        }

        // Process VINFO result
        // VINFO returns an array of alternating keys and values
        const result = redisResult.result as string[]
        const info: Record<string, any> = {}

        for (let i = 0; i < result.length; i += 2) {
            const key = result[i]
            const value = result[i + 1]

            if (key && value !== undefined) {
                // Convert numeric strings to numbers
                if (typeof value === 'string' && !isNaN(Number(value))) {
                    info[key] = Number(value)
                } else {
                    info[key] = value
                }
            }
        }

        return formatResponse({
            success: true,
            result: info,
            executedCommand: commandStr
        })
    } catch (error) {
        return handleError(error)
    }
}

// Also support GET requests for compatibility
export async function GET(request: Request) {
    const url = new URL(request.url)
    const keyName = url.searchParams.get("key")

    // Convert the GET request to a POST request format
    const postRequest = new Request(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify({ keyName })
    })

    return POST(postRequest)
}

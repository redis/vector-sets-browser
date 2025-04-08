import { RedisConnection, getRedisUrl } from '@/app/redis-server/RedisConnection'
import { validateRequest, formatResponse, handleError } from '@/app/redis-server/utils'
import { validateVgetattrRequest, buildVgetattrCommand } from './command'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        // Validate request
        const validatedRequest = await validateRequest(request, validateVgetattrRequest)
        console.log("Received VGETATTR request")
        
        // Get Redis URL
        const redisUrl = await getRedisUrl()
        if (!redisUrl) {
            return NextResponse.json(
                { success: false, error: 'No Redis connection available' },
                { status: 401 }
            )
        }

        // Build command
        const commands = buildVgetattrCommand(validatedRequest)
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

        // VGETATTR returns null if no attributes exist, or a JSON string if they do
        const attributes = redisResult.result

        return formatResponse({
            success: true,
            result: attributes,
            executedCommand: commandStr
        })
    } catch (error) {
        return handleError(error)
    }
}

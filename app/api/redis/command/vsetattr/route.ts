import { RedisConnection, getRedisUrl } from '@/app/redis-server/RedisConnection'
import { validateRequest, formatResponse, handleError } from '@/app/redis-server/utils'
import { validateVsetattrRequest, buildVsetattrCommand } from './command'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        // Validate request
        console.log("Received VSETATTR request", request)
        const validatedRequest = await validateRequest(request, validateVsetattrRequest)
        console.log("Received VSETATTR request", validatedRequest)
        
        // Get Redis URL
        const redisUrl = await getRedisUrl()
        if (!redisUrl) {
            return NextResponse.json(
                { success: false, error: 'No Redis connection available' },
                { status: 401 }
            )
        }

        // Build command
        const command = buildVsetattrCommand(validatedRequest)
        const commandStr = command.join(' ')

        // If returnCommandOnly is true, return just the command
        if (validatedRequest.returnCommandOnly) {
            return NextResponse.json({
                success: true,
                executedCommand: commandStr
            })
        }

        // Execute command
        const redisResult = await RedisConnection.withClient(redisUrl, async (client) => {
            return await client.sendCommand(command)
        })

        // Check if the Redis operation itself failed
        if (!redisResult.success) {
            return formatResponse(redisResult)
        }

        // VSETATTR returns 1 if the attributes were set, 0 if the element doesn't exist
        const success = redisResult.result === 1
        return formatResponse({
            success,
            result: redisResult.result,
            executedCommand: commandStr,
            error: !success ? 'Element does not exist' : undefined
        })
    } catch (error) {
        return handleError(error)
    }
}

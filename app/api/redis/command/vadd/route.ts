import { RedisConnection, getRedisUrl } from '@/lib/redis-server/RedisConnection'
import { validateRequest, formatResponse, handleError } from '@/lib/redis-server/utils'
import { validateVaddRequest, buildVaddCommand } from './command'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        // Validate request
        const validatedRequest = await validateRequest(request, validateVaddRequest)
        console.log("Received VADD request")
        
        // Get Redis URL
        const redisUrl = await getRedisUrl()
        if (!redisUrl) {
            return NextResponse.json(
                { success: false, error: 'No Redis connection available' },
                { status: 401 }
            )
        }

        // Build command
        const command = buildVaddCommand(validatedRequest)
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

        // Redis VADD returns 1 for success, 0 for failure (element exists)
        const success = redisResult.result === 1
        console.log("Redis VADD result", redisResult.result)
        return formatResponse({
            success,
            result: redisResult.result,
            executedCommand: commandStr,
            error: !success ? 'Element already exists' : undefined
        })
    } catch (error) {
        return handleError(error)
    }
} 
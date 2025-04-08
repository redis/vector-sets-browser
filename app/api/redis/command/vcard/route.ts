import { RedisConnection, getRedisUrl } from '@/app/redis-server/RedisConnection'
import { validateRequest, formatResponse, handleError } from '@/app/redis-server/utils'
import { validateVcardRequest, buildVcardCommand } from './command'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        // Validate request
        const validatedRequest = await validateRequest(request, validateVcardRequest)
        console.log("Received VCARD request")
        
        // Get Redis URL
        const redisUrl = await getRedisUrl()
        if (!redisUrl) {
            return NextResponse.json(
                { success: false, error: 'No Redis connection available' },
                { status: 401 }
            )
        }

        // Build command
        const command = buildVcardCommand(validatedRequest)
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

        // VCARD returns the cardinality as a number
        return formatResponse({
            success: true,
            result: redisResult.result,
            executedCommand: commandStr
        })
    } catch (error) {
        return handleError(error)
    }
}

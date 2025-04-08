import { RedisConnection, getRedisUrl } from '@/app/redis-server/RedisConnection'
import { validateRequest, formatResponse, handleError } from '@/app/redis-server/utils'
import { validateVgetattrMultiRequest, buildVgetattrMultiCommand } from './command'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        // Validate request
        const validatedRequest = await validateRequest(request, validateVgetattrMultiRequest)
        
        // Get Redis URL
        const redisUrl = await getRedisUrl()
        if (!redisUrl) {
            return NextResponse.json(
                { success: false, error: 'No Redis connection available' },
                { status: 401 }
            )
        }

        // Build commands
        const commands = buildVgetattrMultiCommand(validatedRequest)
        const commandStr = commands.map(cmd => cmd.join(' ')).join('\n')

        // If returnCommandOnly is true, return just the commands
        if (validatedRequest.returnCommandOnly) {
            return NextResponse.json({
                success: true,
                executedCommand: commandStr
            })
        }

        // Execute commands in a transaction
        const redisResult = await RedisConnection.withClient(redisUrl, async (client) => {
            const multi = client.multi()
            for (const command of commands) {
                multi.addCommand(command)
            }
            return await multi.exec()
        })

        // Check if the Redis operation itself failed
        if (!redisResult.success) {
            return formatResponse(redisResult)
        }

        // Process results
        // Each result will be either a JSON string or null
        const results = redisResult.result as (string | null)[]
        
        return NextResponse.json({
            success: true,
            result: results,
            executedCommand: commandStr
        })
    } catch (error) {
        return handleError(error)
    }
} 
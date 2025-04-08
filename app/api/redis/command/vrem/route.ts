import { RedisConnection, getRedisUrl } from '@/app/redis-server/RedisConnection'
import { validateRequest, formatResponse, handleError } from '@/app/redis-server/utils'
import { validateVremRequest, buildVremCommand } from './command'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        // Validate request
        const validatedRequest = await validateRequest(request, validateVremRequest)
        console.log("Received VREM request", validatedRequest.elements ? "multi" : "single")
        
        // Get Redis URL
        const redisUrl = await getRedisUrl()
        if (!redisUrl) {
            return NextResponse.json(
                { success: false, error: 'No Redis connection available' },
                { status: 401 }
            )
        }

        const commands = buildVremCommand(validatedRequest)
        const commandStr = commands
            .map((cmd) => cmd.join(" "))
            .join(" ")

        // If returnCommandOnly is true, return just the command
        if (validatedRequest.returnCommandOnly) {
            return NextResponse.json({
                success: true,
                executedCommand: commands[0]
            })
        }

        // Execute command
        const redisResult = await RedisConnection.withClient(redisUrl, async (client) => {
            if (validatedRequest.elements) {
                // For multi-element removal, execute each command in a transaction
                // Build command

                const multi = client.multi()
                for (const command of commands) {
                    multi.addCommand(command)
                }
                return await multi.exec()
            } else {
                // Single element removal
                return await client.sendCommand(commands[0])
            }
        })

        // Check if the Redis operation itself failed
        if (!redisResult.success) {
            return formatResponse(redisResult)
        }

        if (validatedRequest.elements) {
            // For multi-element removal, we get an array of results from EXEC
            // Each result is 1 for success or 0 for failure
            const results = redisResult.result as number[]
            const successCount = results.reduce((sum, result) => sum + (result === 1 ? 1 : 0), 0)
            
            return formatResponse({
                success: successCount > 0, // Consider partial success as success
                result: {
                    totalElements: validatedRequest.elements.length,
                    successfulRemovals: successCount,
                    results: results.map((result, index) => ({
                        element: validatedRequest.elements![index],
                        removed: result === 1
                    }))
                },
                executedCommand: commandStr,
                error: successCount === 0 ? 'No elements were removed' : undefined
            })
        } else {
            // Single element removal
            const success = redisResult.result === 1
            return formatResponse({
                success,
                result: redisResult.result,
                executedCommand: commandStr,
                error: !success ? 'Element does not exist' : undefined
            })
        }
    } catch (error) {
        return handleError(error)
    }
}

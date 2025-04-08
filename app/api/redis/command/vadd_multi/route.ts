import { RedisConnection, getRedisUrl } from '@/app/redis-server/RedisConnection'
import { validateRequest, handleError } from '@/app/redis-server/utils'
import { validateVaddMultiRequest, buildVaddMultiCommand } from './command'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        // Validate request
        const validatedRequest = await validateRequest(request, validateVaddMultiRequest)
        console.log("Received VADD_MULTI request")
        
        // Get Redis URL
        const redisUrl = await getRedisUrl()
        if (!redisUrl) {
            return NextResponse.json(
                { success: false, error: 'No Redis connection available' },
                { status: 401 }
            )
        }

        // Build commands
        const commands = buildVaddMultiCommand(validatedRequest)
        const commandStrs = commands.map(cmd => cmd.join(' '))

        // If returnCommandOnly is true, return just the commands
        if (validatedRequest.returnCommandOnly) {
            return NextResponse.json({
                success: true,
                executedCommands: commandStrs
            })
        }

        // Execute commands in a transaction
        const response = await RedisConnection.withClient(redisUrl, async (client) => {
            const multi = client.multi()
            
            commands.forEach(command => {
                multi.addCommand(command)
            })

            return await multi.exec()
        })

        if (!response.success || !response.result) {
            return NextResponse.json({
                success: false,
                error: response.error
            })
        }

        // Process results
        // Each result will be either 1 (success) or 0 (element exists)
        const results = response.result as number[]
        
        return NextResponse.json({
            success: true,
            result: results,
            executedCommands: commandStrs
        })
    } catch (error) {
        return handleError(error)
    }
} 
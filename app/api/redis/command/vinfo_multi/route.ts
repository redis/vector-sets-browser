import { RedisConnection, getRedisUrl } from '@/app/redis-server/RedisConnection'
import { validateRequest, formatResponse, handleError } from '@/app/redis-server/utils'
import { validateVinfoMultiRequest, buildVinfoMultiCommand } from './command'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        // Validate request
        const validatedRequest = await validateRequest(request, validateVinfoMultiRequest)
        console.log("Received VINFO_MULTI request")
        
        // Get Redis URL
        const redisUrl = await getRedisUrl()
        if (!redisUrl) {
            return NextResponse.json(
                { success: false, error: 'No Redis connection available' },
                { status: 401 }
            )
        }

        // Build commands
        const commands = buildVinfoMultiCommand(validatedRequest)
        const commandStrs = commands.map(cmd => cmd.join(' '))

        // If returnCommandOnly is true, return just the commands
        if (validatedRequest.returnCommandOnly) {
            return NextResponse.json({
                success: true,
                executedCommands: commandStrs
            })
        }

        // Execute commands
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
        const processedResults = response.result.map((redisResult, index) => {
            if (!redisResult) {
                return {
                    success: false,
                    error: 'No result from Redis',
                    keyName: validatedRequest.keyNames[index]
                }
            }

            const result = redisResult as string[]
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

            return info
        })

        return NextResponse.json({
            success: true,
            result: processedResults
        })

    } catch (error) {
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        )
    }
}

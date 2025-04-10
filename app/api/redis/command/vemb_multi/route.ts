import { getRedisUrl } from '@/app/redis-server/RedisConnection'
import { validateRequest } from '@/app/redis-server/utils'
import { validateVembMultiRequest, buildVembMultiCommand, fetchEmbeddingsBatch } from './command'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        // Validate request
        const validatedRequest = await validateRequest(request, validateVembMultiRequest)
        console.log("Received VEMB_MULTI request", validatedRequest)
        // Get Redis URL
        const redisUrl = await getRedisUrl()
        if (!redisUrl) {
            return NextResponse.json(
                { success: false, error: 'No Redis connection available' },
                { status: 401 }
            )
        }

        // Build commands
        const commands = buildVembMultiCommand(validatedRequest)
        const commandStrs = commands.map(cmd => cmd.join(' '))

        // If returnCommandOnly is true, return just the commands
        if (validatedRequest.returnCommandOnly) {
            return NextResponse.json({
                success: true,
                executedCommands: commandStrs
            })
        }

        // Use fetchEmbeddingsBatch to get the embeddings
        const embeddingsResult = await fetchEmbeddingsBatch(
            redisUrl,
            validatedRequest.keyName,
            validatedRequest.elements
        )

        if (!embeddingsResult.success) {
            return NextResponse.json({
                success: false,
                error: embeddingsResult.error
            })
        }

        return NextResponse.json({
            success: true,
            result: embeddingsResult.result
        })

    } catch (error) {
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        )
    }
} 
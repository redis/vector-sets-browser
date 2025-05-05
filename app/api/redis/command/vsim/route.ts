import { NextResponse } from 'next/server'
import { RedisConnection, getRedisUrl } from '@/lib/redis-server/RedisConnection'
import { validateVsimRequest, buildVsimCommand } from './command'
import { formatResponse } from '@/lib/redis-server/utils'
import { fetchEmbeddingsBatch } from '@/app/api/redis/command/vemb_multi/command'

type SimPair = [string, number];
type SimPairWithEmb = [string, number, number[] | null];

export async function POST(request: Request) {
    try {
        const body = await request.json()

        const validationResult = validateVsimRequest(body)
        if (!validationResult.isValid || !validationResult.value) {
            console.error('Validation error:', validationResult.error)
            return NextResponse.json(
                { error: validationResult.error },
                { status: 400 }
            )
        }

        const redisUrl = await getRedisUrl()
        if (!redisUrl) {
            return NextResponse.json(
                { error: 'Redis connection not available' },
                { status: 401 }
            )
        }

        const command = buildVsimCommand(validationResult.value)

        if (validationResult.value.returnCommandOnly) {
            return NextResponse.json({ command })
        }

        const commandStr = command[0].join(' ')
        const redisResult = await RedisConnection.withClient(redisUrl, async (client) => {
            return await client.sendCommand(command[0])
        })

        // Check if the Redis operation failed
        if (!redisResult.success) {
            return formatResponse(redisResult)
        }

        // Process the result into pairs of [element, score]
        const pairs: SimPair[] = []
        const resultArray = redisResult.result as string[]
        for (let i = 0; i < resultArray.length; i += 2) {
            pairs.push([resultArray[i], parseFloat(resultArray[i + 1])])
        }

        // If withEmbeddings is requested, fetch them for all elements
        let finalResult: SimPair[] | SimPairWithEmb[] = pairs
        if (validationResult.value.withEmbeddings) {
            console.log("VSIM GET embeddings")
            const elements = pairs.map(([id]) => id)
            const embResults = await fetchEmbeddingsBatch(redisUrl, validationResult.value.keyName, elements)

            if (embResults.success && embResults.result) {
                finalResult = pairs.map(([id, score], index): SimPairWithEmb => 
                    [id, score, embResults.result![index]]
                )
            }
        }

        return formatResponse({
            success: true,
            result: finalResult,
            executedCommand: commandStr,
            executionTimeMs: redisResult.executionTimeMs
        })

    } catch (error) {
        console.error('Error in VSIM route:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
} 
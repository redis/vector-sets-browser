import { NextResponse } from 'next/server'
import { RedisConnection, getRedisUrl } from '@/lib/redis-server/RedisConnection'
import { validateVsimRequest, buildVsimCommand } from './command'
import { formatResponse } from '@/lib/redis-server/utils'
import { fetchEmbeddingsBatch } from '@/app/api/redis/command/vemb_multi/command'

type SimPair = [string, number];
type SimPairWithEmb = [string, number, number[] | null];
type SimPairWithAttribs = [string, number, number[] | null, string | null];

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

        const commandStr = command[0]
            .map((arg) => (arg instanceof Buffer ? '<binary>' : String(arg)))
            .join(' ')

        let redisResult: any
        let useWithAttribs = validationResult.value.withAttribs
        let fallbackUsed = false

        // Try VSIM with WITHATTRIBS if requested
        if (useWithAttribs) {
            try {
                redisResult = await RedisConnection.withClient(redisUrl, async (client) => {
                    return await client.sendCommand(command[0])
                })

                // If WITHATTRIBS failed, we'll fallback to the original method
                if (!redisResult.success) {
                    console.log('VSIM with WITHATTRIBS failed, falling back to original method')
                    useWithAttribs = false
                    fallbackUsed = true
                }
            } catch (error) {
                console.log('VSIM with WITHATTRIBS threw error, falling back to original method:', error)
                useWithAttribs = false
                fallbackUsed = true
            }
        }

        // If not using WITHATTRIBS or fallback is needed, use original command
        if (!useWithAttribs) {
            console.log('VSIM: Using fallback method (no WITHATTRIBS)' + (fallbackUsed ? ' - WITHATTRIBS failed' : ''))
            // Build command without WITHATTRIBS
            const fallbackRequest = { ...validationResult.value, withAttribs: false }
            const fallbackCommand = buildVsimCommand(fallbackRequest)
            
            redisResult = await RedisConnection.withClient(redisUrl, async (client) => {
                return await client.sendCommand(fallbackCommand[0])
            })
        }

        // Check if the Redis operation failed
        if (!redisResult.success) {
            return formatResponse(redisResult)
        }

        // Process the result based on whether WITHATTRIBS was used
        let finalResult: SimPair[] | SimPairWithEmb[] | SimPairWithAttribs[]

        if (useWithAttribs) {
            // WITHATTRIBS returns: element, score, attributes, element, score, attributes, ...
            // The format is: [elem1, score1, attr1, elem2, score2, attr2, ...]
            const resultArray = redisResult.result as any[]
            const pairsWithAttribs: SimPairWithAttribs[] = []
            
            // Parse every 3 items: element, score, attributes
            for (let i = 0; i < resultArray.length; i += 3) {
                if (i + 2 < resultArray.length) {
                    const element = resultArray[i] as string
                    const score = parseFloat(resultArray[i + 1] as string)
                    const attributes = resultArray[i + 2] // Can be null or string
                    
                    pairsWithAttribs.push([
                        element, 
                        score, 
                        null, // embedding will be filled later if needed
                        attributes
                    ])
                }
            }

            finalResult = pairsWithAttribs

            // If withEmbeddings is also requested, fetch them
            if (validationResult.value.withEmbeddings) {
                const elements = pairsWithAttribs.map(([element]) => element)
                const embResults = await fetchEmbeddingsBatch(redisUrl, validationResult.value.keyName, elements)

                if (embResults.success && embResults.result) {
                    finalResult = finalResult.map(([element, score, , attributes], index): SimPairWithAttribs => 
                        [element, score, embResults.result![index], attributes]
                    )
                }
            }
        } else {
            // Original method: pairs of [element, score]
            const pairs: SimPair[] = []
            const resultArray = redisResult.result as string[]
            for (let i = 0; i < resultArray.length; i += 2) {
                pairs.push([resultArray[i], parseFloat(resultArray[i + 1])])
            }

            // If attributes are requested but WITHATTRIBS wasn't used, fetch them separately
            if (validationResult.value.withAttribs || validationResult.value.withEmbeddings) {
                const elements = pairs.map(([element]) => element)
                
                // Fetch attributes if requested (or if fallback was used)
                let attributes: (string | null)[] | null = null
                if (validationResult.value.withAttribs || fallbackUsed) {
                    console.log("VSIM fallback: fetching attributes with VGETATTR_MULTI")
                    const { vgetattr_multi } = await import('@/lib/redis-server/api')
                    const attrResponse = await vgetattr_multi({
                        keyName: validationResult.value.keyName,
                        elements,
                        returnCommandOnly: false,
                    })
                    
                    if (attrResponse.success && attrResponse.result) {
                        attributes = attrResponse.result
                    }
                }

                // Fetch embeddings if requested
                let embeddings: (number[] | null)[] | null = null
                if (validationResult.value.withEmbeddings) {
                    console.log("VSIM fallback: GET embeddings")
                    const embResults = await fetchEmbeddingsBatch(redisUrl, validationResult.value.keyName, elements)
                    if (embResults.success && embResults.result) {
                        embeddings = embResults.result
                    }
                }

                // Build final result with both attributes and embeddings as needed
                finalResult = pairs.map(([element, score], index): SimPairWithAttribs => [
                    element, 
                    score, 
                    embeddings ? embeddings[index] : null,
                    attributes ? attributes[index] : null
                ])
            } else {
                // Just embeddings requested
                if (validationResult.value.withEmbeddings) {
                    console.log("VSIM GET embeddings")
                    const elements = pairs.map(([element]) => element)
                    const embResults = await fetchEmbeddingsBatch(redisUrl, validationResult.value.keyName, elements)

                    if (embResults.success && embResults.result) {
                        finalResult = pairs.map(([element, score], index): SimPairWithEmb => 
                            [element, score, embResults.result![index]]
                        )
                    } else {
                        finalResult = pairs
                    }
                } else {
                    finalResult = pairs
                }
            }
        }

        return formatResponse({
            success: true,
            result: finalResult,
            executedCommand: commandStr + (fallbackUsed ? ' (fallback used)' : ''),
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
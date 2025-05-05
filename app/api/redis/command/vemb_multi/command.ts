import { validateKeyName, validateElement } from '@/lib/redis-server/utils'
import { VembMultiRequestBody } from '@/lib/redis-server/api'
import { RedisConnection, RedisOperationResult } from "@/lib/redis-server/RedisConnection"

export function validateVembMultiRequest(body: any): { isValid: boolean; error?: string; value?: VembMultiRequestBody } {
    if (!validateKeyName(body.keyName)) {
        return { isValid: false, error: 'Key name is required' }
    }

    if (!Array.isArray(body.elements)) {
        return { isValid: false, error: 'Elements must be an array' }
    }

    if (body.elements.length === 0) {
        return { isValid: false, error: 'Elements array cannot be empty' }
    }

    // Validate each element
    for (const element of body.elements) {
        if (!validateElement(element)) {
            return { isValid: false, error: `Invalid element in array: ${element}` }
        }
    }

    return {
        isValid: true,
        value: {
            keyName: body.keyName,
            elements: body.elements,
            returnCommandOnly: body.returnCommandOnly === true
        }
    }
}

export function buildVembMultiCommand(request: VembMultiRequestBody): string[][] {
    // Return an array of VEMB commands, one for each element
    return request.elements.map(element => ['VEMB', request.keyName, element])
}

/**
 * Fetches embeddings for multiple elements in a single batch operation
 * @param redisUrl The Redis connection URL
 * @param keyName The vector set key name
 * @param elements Array of element IDs to fetch embeddings for
 * @returns Array of embeddings (as float arrays) or null for elements that don't have embeddings
 */
export async function fetchEmbeddingsBatch(
    redisUrl: string,
    keyName: string,
    elements: string[]
): Promise<RedisOperationResult<(number[] | null)[]>> {
    return RedisConnection.withClient(redisUrl, async (client) => {
        const multi = client.multi()

        // Add VEMB commands for each element
        elements.forEach((id) => {
            multi.addCommand(["VEMB", keyName, id])
        })

        const result = await multi.exec()

        if (!result) {
            return []
        }

        return result.map((item) =>
            Array.isArray(item)
                ? item.map((val) => parseFloat(String(val)))
                : null
        )
    })
} 
import { validateKeyName } from '@/app/redis-server/utils'

export interface VsimRequest {
    keyName: string
    searchVector?: number[]
    searchElement?: string
    count?: number
    filter?: string
    expansionFactor?: number
    returnCommandOnly?: boolean
    withEmbeddings?: boolean
}

export function validateVsimRequest(body: any): { isValid: boolean; error?: string; value?: VsimRequest } {
    if (!validateKeyName(body.keyName)) {
        return { isValid: false, error: 'Key name is required' }
    }

    // Either searchVector or searchElement must be provided
    if (!body.searchVector && !body.searchElement) {
        return { isValid: false, error: 'Either searchVector or searchElement is required' }
    }

    // If searchVector is provided, validate it
    if (body.searchVector) {
        if (!Array.isArray(body.searchVector)) {
            return { isValid: false, error: 'Search vector must be an array' }
        }

        if (body.searchVector.some((v: number) => typeof v !== 'number' || isNaN(v) || !isFinite(v))) {
            return { isValid: false, error: 'Search vector contains invalid values (NaN or Infinity)' }
        }
    }

    // If searchElement is provided, validate it
    if (body.searchElement && typeof body.searchElement !== 'string') {
        return { isValid: false, error: 'Search element must be a string' }
    }

    // Validate count if provided
    if (body.count !== undefined) {
        const count = Number(body.count)
        if (isNaN(count) || count < 1) {
            return { isValid: false, error: 'Count must be a positive number' }
        }
    }

    // Validate expansionFactor if provided
    if (body.expansionFactor !== undefined) {
        const ef = Number(body.expansionFactor)
        if (isNaN(ef) || ef < 0) {
            return { isValid: false, error: 'Expansion factor must be a non-negative number' }
        }
    }

    return {
        isValid: true,
        value: {
            keyName: body.keyName,
            searchVector: body.searchVector,
            searchElement: body.searchElement,
            count: body.count || 10, // Default to 10 if not specified
            filter: body.filter || '',
            expansionFactor: body.expansionFactor,
            returnCommandOnly: body.returnCommandOnly === true,
            withEmbeddings: body.withEmbeddings === true
        }
    }
}

export function buildVsimCommand(request: VsimRequest): string[][] {
    const baseCommand = ["VSIM", request.keyName]

    if (request.searchVector) {
        baseCommand.push(
            "VALUES",
            String(request.searchVector.length),
            ...request.searchVector.map(String)
        )
    } else if (request.searchElement) {
        baseCommand.push("ELE", request.searchElement)
    }

    // Add filter if provided
    if (request.filter && request.filter !== "") {
        baseCommand.push("FILTER", request.filter)
    }

    // Always add WITHSCORES for consistent result format
    baseCommand.push("WITHSCORES")

    // Add count
    baseCommand.push("COUNT", String(request.count))

    // Add expansion factor if provided
    if (request.expansionFactor && request.expansionFactor > 0) {
        baseCommand.push("EF", String(request.expansionFactor))
    }

    return [baseCommand]
} 
import { validateKeyName } from '@/app/redis-server/utils'
import { VsimRequestBody } from '@/app/redis-server/api'

export function validateVsimRequest(body: any): { isValid: boolean; error?: string; value?: VsimRequestBody } {
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

    // Validate searchExplorationFactor if provided
    if (body.searchExplorationFactor !== undefined) {
        const ef = Number(body.searchExplorationFactor)
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
            searchExplorationFactor: body.searchExplorationFactor,
            filterExplorationFactor: body.filterExplorationFactor,
            returnCommandOnly: body.returnCommandOnly === true,
            withEmbeddings: body.withEmbeddings === true,
            forceLinearScan: body.forceLinearScan === true,
            noThread: body.noThread === true
        }
    }
}

export function buildVsimCommand(request: VsimRequestBody): string[][] {
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

    // Add searchExplorationFactor if provided
    if (request.searchExplorationFactor && request.searchExplorationFactor > 0) {
        baseCommand.push("EF", String(request.searchExplorationFactor))
    }
    
    // Add filterExplorationFactor if provided
    if (request.filterExplorationFactor && request.filterExplorationFactor > 0) {
        console.log("FILTER-EF", String(request.filterExplorationFactor))
        baseCommand.push("FILTER-EF", String(request.filterExplorationFactor))
    }

    // Add forceLinearScan if provided
    if (request.forceLinearScan) {
        baseCommand.push("TRUTH")
    }

    // Add noThread if provided
    if (request.noThread) {
        baseCommand.push("NOTHREAD")
    }

    return [baseCommand]
} 
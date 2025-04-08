import { validateKeyName, validateElement } from '@/app/redis-server/utils'

export interface VgetattrMultiRequest {
    keyName: string
    elements: string[]
    returnCommandOnly?: boolean
}

export function validateVgetattrMultiRequest(body: any): { isValid: boolean; error?: string; value?: VgetattrMultiRequest } {
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

export function buildVgetattrMultiCommand(request: VgetattrMultiRequest): string[][] {
    // Return an array of VGETATTR commands, one for each element
    return request.elements.map(element => ['VGETATTR', request.keyName, element])
} 
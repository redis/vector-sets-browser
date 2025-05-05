import { validateKeyName, validateElement } from '@/lib/redis-server/utils'
import { VremRequestBody } from '@/lib/redis-server/api'

export function validateVremRequest(body: any): { isValid: boolean; error?: string; value?: VremRequestBody } {
    if (!validateKeyName(body.keyName)) {
        return { isValid: false, error: 'Key name is required' }
    }

    // Check that exactly one of element or elements is provided
    if (!body.element && !body.elements) {
        return { isValid: false, error: 'Either element or elements array is required' }
    }
    if (body.element && body.elements) {
        return { isValid: false, error: 'Only one of element or elements array should be provided' }
    }

    // Validate single element
    if (body.element && !validateElement(body.element)) {
        return { isValid: false, error: 'Element is invalid' }
    }

    // Validate elements array
    if (body.elements) {
        if (!Array.isArray(body.elements)) {
            return { isValid: false, error: 'Elements must be an array' }
        }
        if (body.elements.length === 0) {
            return { isValid: false, error: 'Elements array cannot be empty' }
        }
        for (const element of body.elements) {
            if (!validateElement(element)) {
                return { isValid: false, error: `Invalid element in array: ${element}` }
            }
        }
    }

    return {
        isValid: true,
        value: {
            keyName: body.keyName,
            element: body.element,
            elements: body.elements,
            returnCommandOnly: body.returnCommandOnly === true
        }
    }
}

export function buildVremCommand(request: VremRequestBody): string[][] {
    if (request.element) {
        // Single element removal
        return [['VREM', request.keyName, request.element]]
    } else if (request.elements) {
        // For multi-element removal, return array of VREM commands
        // Note: The actual transaction (MULTI/EXEC) is handled in the route
        return request.elements.map(element => ['VREM', request.keyName, element])
    }
    throw new Error('Either element or elements must be provided')
} 
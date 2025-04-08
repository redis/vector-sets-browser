import { validateKeyName, validateElement } from '@/app/redis-server/utils'

export interface VsetattrRequest {
    keyName: string
    element: string
    attributes: string
    returnCommandOnly?: boolean
}

export function validateVsetattrRequest(body: any): { isValid: boolean; error?: string; value?: VsetattrRequest } {
    if (!validateKeyName(body.keyName)) {
        return { isValid: false, error: 'Key name is required' }
    }

    if (!validateElement(body.element)) {
        return { isValid: false, error: 'Element is required' }
    }

    // Validate attributes is a valid JSON string
    if (typeof body.attributes !== 'string') {
        return { isValid: false, error: 'Attributes must be a JSON string' }
    }

    try {
        JSON.parse(body.attributes)
    } catch (e) {
        return { isValid: false, error: 'Attributes must be a valid JSON string' }
    }

    return {
        isValid: true,
        value: {
            keyName: body.keyName,
            element: body.element,
            attributes: body.attributes,
            returnCommandOnly: body.returnCommandOnly === true
        }
    }
}

export function buildVsetattrCommand(request: VsetattrRequest): string[] {
    return ['VSETATTR', request.keyName, request.element, request.attributes]
} 
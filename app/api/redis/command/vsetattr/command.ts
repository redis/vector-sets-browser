import { validateKeyName, validateElement } from '@/lib/redis-server/utils'
import { VsetAttrRequestBody } from '@/lib/redis-server/api'

export function validateVsetattrRequest(body: any): { isValid: boolean; error?: string; value?: VsetAttrRequestBody } {
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
    } catch (_e) {
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

export function buildVsetattrCommand(request: VsetAttrRequestBody): string[] {
    return ['VSETATTR', request.keyName, request.element, request.attributes]
} 
import { validateKeyName, validateElement } from '@/app/redis-server/utils'
import { VgetAttrRequestBody } from '@/app/redis-server/api'

export function validateVgetattrRequest(body: any): { isValid: boolean; error?: string; value?: VgetAttrRequestBody } {
    if (!validateKeyName(body.keyName)) {
        return { isValid: false, error: 'Key name is required' }
    }

    if (!validateElement(body.element)) {
        return { isValid: false, error: 'Element is required' }
    }

    return {
        isValid: true,
        value: {
            keyName: body.keyName,
            element: body.element,
            returnCommandOnly: body.returnCommandOnly === true
        }
    }
}

export function buildVgetattrCommand(request: VgetAttrRequestBody): string[][] {
    return [['VGETATTR', request.keyName, request.element]]
} 
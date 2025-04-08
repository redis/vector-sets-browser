import { validateKeyName, validateElement } from '@/app/redis-server/utils'

export interface VgetattrRequest {
    keyName: string
    element: string
    returnCommandOnly?: boolean
}

export function validateVgetattrRequest(body: any): { isValid: boolean; error?: string; value?: VgetattrRequest } {
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

export function buildVgetattrCommand(request: VgetattrRequest): string[][] {
    return [['VGETATTR', request.keyName, request.element]]
} 
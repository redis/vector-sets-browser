import { validateKeyName } from '@/app/redis-server/utils'

export interface VcardRequest {
    keyName: string
    returnCommandOnly?: boolean
}

export function validateVcardRequest(body: any): { isValid: boolean; error?: string; value?: VcardRequest } {
    if (!validateKeyName(body.keyName)) {
        return { isValid: false, error: 'Key name is required' }
    }

    return {
        isValid: true,
        value: {
            keyName: body.keyName,
            returnCommandOnly: body.returnCommandOnly === true
        }
    }
}

export function buildVcardCommand(request: VcardRequest): string[] {
    return ['VCARD', request.keyName]
} 
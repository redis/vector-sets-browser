import { validateKeyName } from '@/lib/redis-server/utils'
import { VcardRequestBody } from '@/lib/redis-server/api'

export function validateVcardRequest(body: any): { isValid: boolean; error?: string; value?: VcardRequestBody } {
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

export function buildVcardCommand(request: VcardRequestBody): string[] {
    return ['VCARD', request.keyName]
} 
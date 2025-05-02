import { validateKeyName } from '@/app/redis-server/utils'
import { VinfoRequestBody } from '@/app/redis-server/api'

export function validateVinfoRequest(body: any): { isValid: boolean; error?: string; value?: VinfoRequestBody } {
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

export function buildVinfoCommand(request: VinfoRequestBody): string[][] {
    return [['VINFO', request.keyName]]
} 
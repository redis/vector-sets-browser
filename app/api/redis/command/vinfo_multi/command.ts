import { validateKeyName } from '@/app/redis-server/utils'
import { VinfoMultiRequestBody } from '@/app/redis-server/api'

export function validateVinfoMultiRequest(body: any): { isValid: boolean; error?: string; value?: VinfoMultiRequestBody } {
    if (!body.keyNames || !Array.isArray(body.keyNames) || body.keyNames.length === 0) {
        return { isValid: false, error: 'Key names array is required and must not be empty' }
    }

    // Validate each key name
    for (const keyName of body.keyNames) {
        if (!validateKeyName(keyName)) {
            return { isValid: false, error: `Invalid key name: ${keyName}` }
        }
    }

    return {
        isValid: true,
        value: {
            keyNames: body.keyNames,
            returnCommandOnly: body.returnCommandOnly === true
        }
    }
}

export function buildVinfoMultiCommand(request: VinfoMultiRequestBody): string[][] {
    // Return an array of VINFO commands, one for each key
    return request.keyNames.map(keyName => ['VINFO', keyName])
} 
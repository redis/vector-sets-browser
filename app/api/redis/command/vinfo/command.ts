import { validateKeyName } from '@/app/redis-server/utils'

export interface VinfoRequest {
    keyName: string
    returnCommandOnly?: boolean
}

export function validateVinfoRequest(body: any): { isValid: boolean; error?: string; value?: VinfoRequest } {
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

export function buildVinfoCommand(request: VinfoRequest): string[][] {
    return [['VINFO', request.keyName]]
} 
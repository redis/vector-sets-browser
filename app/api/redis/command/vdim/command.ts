import { validateKeyName } from '@/app/redis-server/utils'

export interface VdimRequest {
    keyName: string
    returnCommandOnly?: boolean
}

export function validateVdimRequest(body: any): { isValid: boolean; error?: string; value?: VdimRequest } {
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

export function buildVdimCommand(request: VdimRequest): string[] {
    return ['VDIM', request.keyName]
} 
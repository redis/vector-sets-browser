import { validateKeyName } from '@/app/redis-server/utils'
import { VdimRequestBody } from '@/app/redis-server/api'

export function validateVdimRequest(body: any): { isValid: boolean; error?: string; value?: VdimRequestBody } {
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

export function buildVdimCommand(request: VdimRequestBody): string[] {
    return ['VDIM', request.keyName]
} 
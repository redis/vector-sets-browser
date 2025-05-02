import { validateElement, validateKeyName, validateVector } from '@/app/redis-server/utils'
import { VaddRequestBody } from '@/app/redis-server/api'

export function validateVaddRequest(body: any): { isValid: boolean; error?: string; value?: VaddRequestBody } {
    if (!validateKeyName(body.keyName)) {
        return { isValid: false, error: 'Key name is required' }
    }

    if (!validateElement(body.element)) {
        return { isValid: false, error: 'Element is required' }
    }

    const vectorValidation = validateVector(body.vector)
    if (!vectorValidation.isValid) {
        return { isValid: false, error: vectorValidation.error }
    }

    return {
        isValid: true,
        value: {
            keyName: body.keyName,
            element: body.element,
            vector: body.vector,
            attributes: body.attributes,
            reduceDimensions: typeof body.reduceDimensions === 'number' ? body.reduceDimensions : undefined,
            useCAS: typeof body.useCAS === 'boolean' ? body.useCAS : undefined,
            ef: typeof body.ef === 'number' ? body.ef : undefined,
            quantization: typeof body.quantization === 'string' ? body.quantization : undefined,
            returnCommandOnly: body.returnCommandOnly === true
        }
    }
}

export function buildVaddCommand(request: VaddRequestBody): string[] {
    const command = ['VADD', request.keyName]

    if (request.reduceDimensions) {
        command.push('REDUCE', request.reduceDimensions.toString())
    }

    command.push(
        'VALUES',
        request.vector.length.toString(),
        ...request.vector.map(v => v.toString()),
        request.element
    )

    if (request.attributes) {
        command.push('SETATTR', request.attributes)
    }

    if (request.useCAS) {
        command.push('CAS')
    }

    if (request.quantization) {
        command.push(request.quantization)
    }

    if (request.ef) {
        command.push('EF', request.ef.toString())
    }

    return command
} 
import { validateKeyName, validateElement, validateVector } from '@/lib/redis-server/utils'
import { VaddMultiRequestBody } from '@/lib/redis-server/api'

export function validateVaddMultiRequest(body: any): { isValid: boolean; error?: string; value?: VaddMultiRequestBody } {
    if (!validateKeyName(body.keyName)) {
        return { isValid: false, error: 'Key name is required' }
    }

    if (!Array.isArray(body.elements) || body.elements.length === 0) {
        return { isValid: false, error: 'Elements array is required and must not be empty' }
    }

    if (!Array.isArray(body.vectors) || body.vectors.length === 0) {
        return { isValid: false, error: 'Vectors array is required and must not be empty' }
    }

    if (body.elements.length !== body.vectors.length) {
        return { isValid: false, error: `Mismatch between elements (${body.elements.length}) and vectors (${body.vectors.length})` }
    }

    // Validate each element
    for (const element of body.elements) {
        if (!validateElement(element)) {
            return { isValid: false, error: `Invalid element in array: ${element}` }
        }
    }

    // Validate each vector
    for (const vector of body.vectors) {
        const vectorValidation = validateVector(vector)
        if (!vectorValidation.isValid) {
            return { isValid: false, error: vectorValidation.error }
        }
    }

    return {
        isValid: true,
        value: {
            keyName: body.keyName,
            elements: body.elements,
            vectors: body.vectors,
            attributes: body.attributes,
            reduceDimensions: typeof body.reduceDimensions === 'number' ? body.reduceDimensions : undefined,
            useCAS: typeof body.useCAS === 'boolean' ? body.useCAS : undefined,
            ef: typeof body.ef === 'number' ? body.ef : undefined,
            returnCommandOnly: body.returnCommandOnly === true
        }
    }
}

export function buildVaddMultiCommand(request: VaddMultiRequestBody): string[][] {
    // Return an array of VADD commands, one for each element-vector pair
    return request.elements.map((element, index) => {
        const command = ['VADD', request.keyName]

        if (request.reduceDimensions) {
            command.push('REDUCE', request.reduceDimensions.toString())
        }

        command.push(
            'VALUES',
            request.vectors[index].length.toString(),
            ...request.vectors[index].map(v => v.toString()),
            element
        )

        // Handle attributes if provided
        if (request.attributes && request.attributes[index]) {
            command.push('SETATTR', JSON.stringify(request.attributes[index]))
        }

        if (request.useCAS) {
            command.push('CAS')
        }

        if (request.ef) {
            command.push('EF', request.ef.toString())
        }

        return command
    })
} 
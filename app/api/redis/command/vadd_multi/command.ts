import { validateKeyName, validateElement, validateVector } from '@/app/redis-server/utils'
import { VaddOptions } from '../vadd/command'

export interface VaddMultiRequest {
    keyName: string
    elements: string[]
    vectors: number[][]
    options?: VaddOptions
    returnCommandOnly?: boolean
}

export function validateVaddMultiRequest(body: any): { isValid: boolean; error?: string; value?: VaddMultiRequest } {
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

    // Extract options if present
    const options: VaddOptions = {}
    if (typeof body.reduceDimensions === 'number') {
        options.reduceDimensions = body.reduceDimensions
    }
    if (typeof body.useCAS === 'boolean') {
        options.useCAS = body.useCAS
    }
    if (typeof body.ef === 'number') {
        options.ef = body.ef
    }
    if (typeof body.quantization === 'string') {
        options.quantization = body.quantization
    }
    if (typeof body.attributes === 'string') {
        options.attributes = body.attributes
    }

    return {
        isValid: true,
        value: {
            keyName: body.keyName,
            elements: body.elements,
            vectors: body.vectors,
            options: Object.keys(options).length > 0 ? options : undefined,
            returnCommandOnly: body.returnCommandOnly === true
        }
    }
}

export function buildVaddMultiCommand(request: VaddMultiRequest): string[][] {
    // Return an array of VADD commands, one for each element-vector pair
    return request.elements.map((element, index) => {
        const command = ['VADD', request.keyName]

        if (request.options?.reduceDimensions) {
            command.push('REDUCE', request.options.reduceDimensions.toString())
        }

        command.push(
            'VALUES',
            request.vectors[index].length.toString(),
            ...request.vectors[index].map(v => v.toString()),
            element
        )

        if (request.options?.attributes) {
            command.push('SETATTR', request.options.attributes)
        }

        if (request.options?.useCAS) {
            command.push('CAS')
        }

        if (request.options?.quantization) {
            command.push(request.options.quantization)
        }

        if (request.options?.ef) {
            command.push('EF', request.options.ef.toString())
        }

        return command
    })
} 
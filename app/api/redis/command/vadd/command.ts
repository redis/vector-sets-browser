import { validateElement, validateKeyName, validateVector } from '@/app/redis-server/utils'

export interface VaddOptions {
    reduceDimensions?: number
    useCAS?: boolean
    ef?: number
    quantization?: string
    attributes?: string
    maxConnections?: number
}

export interface VaddRequest {
    keyName: string
    element: string
    vector: number[]
    options?: VaddOptions
    returnCommandOnly?: boolean
}

export function validateVaddRequest(body: any): { isValid: boolean; error?: string; value?: VaddRequest } {
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
    if (typeof body.maxConnections === 'number') {
        options.maxConnections = body.maxConnections
    }

    return {
        isValid: true,
        value: {
            keyName: body.keyName,
            element: body.element,
            vector: body.vector,
            options: Object.keys(options).length > 0 ? options : undefined,
            returnCommandOnly: body.returnCommandOnly === true
        }
    }
}

export function buildVaddCommand(request: VaddRequest): string[] {
    const command = ['VADD', request.keyName]

    if (request.options?.reduceDimensions) {
        command.push('REDUCE', request.options.reduceDimensions.toString())
    }

    command.push(
        'VALUES',
        request.vector.length.toString(),
        ...request.vector.map(v => v.toString()),
        request.element
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

    if (request.options?.maxConnections) {
        command.push('M', request.options.maxConnections.toString())
    }

    return command
} 
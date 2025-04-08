import { NextResponse } from 'next/server'
import { RedisOperationResult } from './RedisConnection'
import { cookies } from 'next/headers'

export interface ApiResponse<T = any> {
    success: boolean
    result?: T
    error?: string
    executionTimeMs?: number
    executedCommand?: string
}

export async function validateRequest<T>(
    request: Request,
    validator: (body: any) => { isValid: boolean; error?: string; value?: T }
): Promise<T> {
    let body: any
    
    try {
        body = await request.json()
    } catch (error) {
        throw new Error('Invalid JSON in request body')
    }

    const validation = validator(body)
    if (!validation.isValid) {
        throw new Error(validation.error || 'Invalid request data')
    }

    return validation.value as T
}

export function formatResponse<T>(response: RedisOperationResult<T>): NextResponse {
    if (!response.success) {
        return NextResponse.json(
            {
                success: false,
                error: response.error
            },
            { status: 400 }
        )
    }

    return NextResponse.json({
        success: true,
        result: response.result,
        executionTimeMs: response.executionTimeMs,
        executedCommand: response.executedCommand
    })
}

export function handleError(error: unknown): NextResponse {
    console.error('Redis operation error:', error)
    
    if (error instanceof Error) {
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        })
    }

    return NextResponse.json(
        {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        },
        { status: 500 }
    )
}

// Validation helpers
export function validateKeyName(keyName: string | undefined): boolean {
    return typeof keyName === 'string' && keyName.length > 0
}

export function validateVector(vector: unknown): { isValid: boolean; error?: string } {
    if (!Array.isArray(vector)) {
        return { isValid: false, error: 'Vector must be an array' }
    }

    if (vector.length === 0) {
        return { isValid: false, error: 'Vector cannot be empty' }
    }

    if (vector.some(v => typeof v !== 'number' || isNaN(v))) {
        return { isValid: false, error: 'Vector must contain only numbers' }
    }

    return { isValid: true }
}

export function validateElement(element: string | undefined): boolean {
    return typeof element === 'string' && element.length > 0
}

import { validateKeyName } from "@/app/redis-server/utils"

export interface VembRequest {
    keyName: string
    element: string
    returnCommandOnly?: boolean
}

export function validateVembRequest(body: any): {
    isValid: boolean
    error?: string
    value?: VembRequest
} {
    if (!validateKeyName(body.keyName)) {
        return { isValid: false, error: "Key name is required" }
    }

    return {
        isValid: true,
        value: {
            keyName: body.keyName,
            element: body.element,
            returnCommandOnly: body.returnCommandOnly === true,
        },
    }
}

export function buildVembCommand(request: VembRequest): string[] {
    return ["VEMB", request.keyName, request.element]
}


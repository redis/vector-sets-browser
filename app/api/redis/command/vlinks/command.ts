import { validateKeyName } from "@/app/redis-server/utils"

export interface VlinksRequest {
    keyName: string
    element: string
    withEmbeddings?: boolean
    count?: number
    returnCommandOnly?: boolean
}

export function validateVlinksRequest(body: any): {
    isValid: boolean
    error?: string
    value?: VlinksRequest
} {
    if (!validateKeyName(body.keyName)) {
        return { isValid: false, error: "Key name is required" }
    }

    return {
        isValid: true,
        value: {
            keyName: body.keyName,
            element: body.element,
            withEmbeddings: body.withEmbeddings === true,
            returnCommandOnly: body.returnCommandOnly === true,
        },
    }
}

export function buildVlinksCommand(request: VlinksRequest): string[] {
    return ["VLINKS", request.keyName, request.element, "WITHSCORES"]
}

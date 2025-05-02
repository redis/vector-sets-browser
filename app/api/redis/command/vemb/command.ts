import { validateKeyName } from "@/app/redis-server/utils"
import { VembRequestBody } from "@/app/redis-server/api"

export function validateVembRequest(body: any): {
    isValid: boolean
    error?: string
    value?: VembRequestBody
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

export function buildVembCommand(request: VembRequestBody): string[] {
    return ["VEMB", request.keyName, request.element]
}


import { validateKeyName } from "@/lib/redis-server/utils"
import { VlinksRequestBody } from "@/lib/redis-server/api"

export function validateVlinksRequest(body: any): {
    isValid: boolean
    error?: string
    value?: VlinksRequestBody
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
            count: body.count,
            returnCommandOnly: body.returnCommandOnly === true,
        },
    }
}

export function buildVlinksCommand(request: VlinksRequestBody): string[] {
    return ["VLINKS", request.keyName, request.element, "WITHSCORES"]
}

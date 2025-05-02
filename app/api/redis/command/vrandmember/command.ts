import { validateKeyName } from "@/app/redis-server/utils"
import { VrandMemberRequestBody } from "@/app/redis-server/api"

export function validateVrandMemberRequest(body: any): {
    isValid: boolean
    error?: string
    value?: VrandMemberRequestBody
} {
    if (!validateKeyName(body.keyName)) {
        return { isValid: false, error: "Key name is required" }
    }

    return {
        isValid: true,
        value: {
            keyName: body.keyName,
            count: body.count,
            returnCommandOnly: body.returnCommandOnly === true,
        },
    }
}

export function buildVrandMemberCommand(request: VrandMemberRequestBody): string[] {
    return ["VRANDMEMBER", request.keyName, request.count.toString()]
}

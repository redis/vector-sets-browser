import { apiClient } from "@/app/api/client"
import { ApiResponse } from "@/app/api/client"

// Common vector types
export type VectorTuple = [string, number, number[] | null, string | null] // [element, score, vector?, attributes?]
export type VectorTupleLevel = VectorTuple[]
export type VectorTupleLevels = VectorTupleLevel[]

// VINFO command
export interface VinfoRequestBody {
    keyName: string
}

export type VinfoResult = {
    dimension: number
    count: number
    type: string
    memory_usage: number
    [key: string]: string | number
}

export async function vinfo(
    request: VinfoRequestBody
): Promise<ApiResponse<VinfoResult>> {
    try {
        return await apiClient.post<VinfoResult, VinfoRequestBody>(
            "/api/redis/command/vinfo",
            request
        )
    } catch (error) {
        return { success: false, error: String(error) }
    }
}

// VINFO_MULTI command
export interface VinfoMultiRequestBody {
    keyNames: string[]
    returnCommandOnly?: boolean
}

export type VinfoMultiResult = VinfoResult[]

export async function vinfo_multi(
    request: VinfoMultiRequestBody
): Promise<ApiResponse<VinfoMultiResult>> {
    try {
        return await apiClient.post<VinfoMultiResult, VinfoMultiRequestBody>(
            "/api/redis/command/vinfo_multi",
            request
        )
    } catch (error) {
        return { success: false, error: String(error) }
    }
}

// VDIM command
export interface VdimRequestBody {
    keyName: string
}

export type VdimResult = number

export async function vdim(
    request: VdimRequestBody
): Promise<ApiResponse<VdimResult>> {
    try {
        return await apiClient.post<VdimResult, VdimRequestBody>(
            "/api/redis/command/vdim",
            request
        )
    } catch (error) {
        return { success: false, error: String(error) }
    }
}

// VCARD command
export interface VcardRequestBody {
    keyName: string
}

export type VcardResult = number

export async function vcard(
    request: VcardRequestBody
): Promise<ApiResponse<VcardResult>> {
    try {
        return await apiClient.post<VcardResult, VcardRequestBody>(
            "/api/redis/command/vcard",
            request
        )
    } catch (error) {
        return { success: false, error: String(error) }
    }
}

// VREM command
export interface VremRequestBody {
    keyName: string
    element?: string
    elements?: string[]
}

export type VremResult = boolean

export async function vrem(
    request: VremRequestBody
): Promise<ApiResponse<VremResult>> {
    try {
        return await apiClient.post<VremResult, VremRequestBody>(
            "/api/redis/command/vrem",
            request
        )
    } catch (error) {
        return { success: false, error: String(error) }
    }
}

// VEMB command
export interface VembRequestBody {
    keyName: string
    element: string
    returnCommandOnly?: boolean
}

export type VembResult = number[]

export async function vemb(
    request: VembRequestBody
): Promise<ApiResponse<VembResult>> {
    try {
        return await apiClient.post<VembResult, VembRequestBody>(
            "/api/redis/command/vemb",
            request
        )
    } catch (error) {
        return { success: false, error: String(error) }
    }
}

// VADD command
export interface VaddRequestBody {
    keyName: string
    element: string
    vector: number[]
    attributes?: string
    reduceDimensions?: number
    useCAS?: boolean
    ef?: number
    quantization?: string
    returnCommandOnly?: boolean
}

export type VaddResult = boolean

export async function vadd(
    request: VaddRequestBody
): Promise<ApiResponse<VaddResult>> {
    try {
        return await apiClient.post<VaddResult, VaddRequestBody>(
            "/api/redis/command/vadd",
            request
        )
    } catch (error) {
        return { success: false, error: String(error) }
    }
}

// VADD_MULTI command
export interface VaddMultiRequestBody {
    keyName: string
    elements: string[]
    vectors: number[][]
    attributes?: Record<string, string | boolean | number>[]
    reduceDimensions?: number
    useCAS?: boolean
    ef?: number
}

export type VaddMultiResult = boolean[]

export async function vadd_multi(
    request: VaddMultiRequestBody
): Promise<ApiResponse<VaddMultiResult>> {
    try {
        return await apiClient.post<VaddMultiResult, VaddMultiRequestBody>(
            "/api/redis/command/vadd_multi",
            request
        )
    } catch (error) {
        return { success: false, error: String(error) }
    }
}

// VLINKS command
export interface VlinksRequestBody {
    keyName: string
    element: string
    count?: number
    withEmbeddings?: boolean
}

export type VlinksResult = VectorTupleLevels

export async function vlinks(
    request: VlinksRequestBody
): Promise<ApiResponse<VlinksResult>> {
    try {
        return await apiClient.post<VlinksResult, VlinksRequestBody>(
            "/api/redis/command/vlinks",
            request
        )
    } catch (error) {
        return { success: false, error: String(error) }
    }
}

// VSIM command
export type VsimResult = [string, number, number[] | null, string | null][] // Keep the existing tuple type

export interface VsimRequestBody {
    keyName: string
    searchVector?: number[]
    searchElement?: string
    count?: number
    filter?: string
    withEmbeddings?: boolean
    searchExplorationFactor?: number
    filterExplorationFactor?: number
    returnCommandOnly?: boolean
    forceLinearScan?: boolean
    noThread?: boolean
}

export async function vsim(
    request: VsimRequestBody
): Promise<ApiResponse<VsimResult>> {
    try {
        return await apiClient.post<VsimResult, VsimRequestBody>(
            "/api/redis/command/vsim",
            request
        )
    } catch (error) {
        console.error("Error in vsim:", error)
        return {
            success: false,
            error: String(error),
        }
    }
}

// VRANDMEMBER command
export interface VrandMemberRequestBody {
    keyName: string
    count: number
    returnCommandOnly?: boolean
}

export type VrandMemberResult = string[]

export async function vrandmember(
    request: VrandMemberRequestBody
): Promise<ApiResponse<VrandMemberResult>> {
    try {
        return await apiClient.post<VrandMemberResult, VrandMemberRequestBody>(
            "/api/redis/command/vrandmember",
            request
        )
    } catch (error) {
        return { success: false, error: String(error) }
    }
}

// VSETATTR command
export interface VsetAttrRequestBody {
    keyName: string
    element: string
    attributes: string // JSON string
}

export type VsetAttrResult = boolean

export async function vsetattr(
    request: VsetAttrRequestBody
): Promise<ApiResponse<VsetAttrResult>> {
    try {
        return await apiClient.post<VsetAttrResult, VsetAttrRequestBody>(
            "/api/redis/command/vsetattr",
            request
        )
    } catch (error) {
        return { success: false, error: String(error) }
    }
}

// VGETATTR command
export interface VgetAttrRequestBody {
    keyName: string
    element: string
    returnCommandOnly?: boolean
}

export type VgetAttrResult = string | null

export async function vgetattr(
    request: VgetAttrRequestBody
): Promise<ApiResponse<VgetAttrResult>> {
    try {
        return await apiClient.post<VgetAttrResult, VgetAttrRequestBody>(
            "/api/redis/command/vgetattr",
            request
        )
    } catch (error) {
        console.error("Error in vgetattr:", error)
        return {
            success: false,
            error: String(error),
        }
    }
}

// VGETATTR_MULTI command
export interface VgetAttrMultiRequestBody {
    keyName: string
    elements: string[]
    returnCommandOnly?: boolean
}

export type VgetAttrMultiResult = (string | null)[]

export async function vgetattr_multi(
    request: VgetAttrMultiRequestBody
): Promise<ApiResponse<VgetAttrMultiResult>> {
    try {
        return await apiClient.post<
            VgetAttrMultiResult,
            VgetAttrMultiRequestBody
        >("/api/redis/command/vgetattr_multi", request)
    } catch (error) {
        return { success: false, error: String(error) }
    }
}

// VEMB_MULTI command
export interface VembMultiRequestBody {
    keyName: string
    elements: string[]
    returnCommandOnly?: boolean
}

export type VembMultiResult = number[][]

export async function vemb_multi(
    request: VembMultiRequestBody
): Promise<ApiResponse<VembMultiResult>> {
    try {
        return await apiClient.post<VembMultiResult, VembMultiRequestBody>(
            "/api/redis/command/vemb_multi",
            request
        )
    } catch (error) {
        return { success: false, error: String(error) }
    }
}

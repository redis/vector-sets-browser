import { apiClient } from "../api/client";

// Common vector types
export type VectorTuple = [string, number, number[] | null, string]; // [element, score, vector?, attributes?]
export type VectorTupleLevel = VectorTuple[];
export type VectorTupleLevels = VectorTupleLevel[];

// VINFO command
export interface VinfoRequestBody {
    keyName: string;
}

export interface VinfoResponse {
    dimension: number;
    count: number;
    type: string;
    memory_usage: number;
    [key: string]: string | number;
}

export async function vinfo(request: VinfoRequestBody) {
    const response = await apiClient.post<VinfoResponse, VinfoRequestBody>(
        "/api/redis/command/vinfo",
        request
    );
    return response.result
}

// VDIM command
export interface VdimRequestBody {
    keyName: string;
}

export async function vdim(request: VdimRequestBody): Promise<number> {
    const response = await apiClient.post<number, VdimRequestBody>(
        "/api/redis/command/vdim",
        request
    );
    return response.result || 0
}

// VCARD command
export interface VcardRequestBody {
    keyName: string;
}

export async function vcard(request: VcardRequestBody): Promise<number> {
    const response = await apiClient.post<number, VcardRequestBody>(
        "/api/redis/command/vcard",
        request
    );
    return response.result || 0
}

// VREM command
export interface VremRequestBody {
    keyName: string;
    element?: string;
    elements?: string[];
}

export async function vrem(request: VremRequestBody) {
    const response = await apiClient.post<boolean, VremRequestBody>(
        "/api/redis/command/vrem",
        request
    );
    return response.result
}

// VEMB command
export interface VembRequestBody {
    keyName: string;
    element?: string;
    elements?: string[];
}

export async function vemb(request: VembRequestBody) {
    const response = await apiClient.post<number[], VembRequestBody>(
        "/api/redis/command/vemb",
        request
    );
    return response.result
}

// VADD command
export interface VaddRequestBody {
    keyName: string;
    element: string;
    vector: number[];
    attributes?: string;
    reduceDimensions?: number;
    useCAS?: boolean;
    ef?: number;
    quantization?: string;
    returnCommandOnly?: boolean;
}

// VADD_MULTI command
export interface VaddMultiRequestBody {
    keyName: string;
    elements: string[];
    vectors: number[][];
    attributes?: Record<string, string | boolean | number>[];
    reduceDimensions?: number;
    useCAS?: boolean;
    ef?: number;
}

export interface VaddResponse {
    success: boolean;
    error?: string;
    executionTimeMs?: number;
    executedCommand?: string;
}

export async function vadd(request: VaddRequestBody) {
    try {
        const response = await apiClient.post<VaddResponse, VaddRequestBody>(
            "/api/redis/command/vadd",
            request
        );
        return response.result
    } catch (error) {
        console.error("[vadd] API error:", error);
        // Re-throw the error to be caught by the caller
        throw error;
    }
}

export async function vadd_multi(request: VaddMultiRequestBody) {
    try {
        const response = await apiClient.post<boolean[], VaddMultiRequestBody>(
            "/api/redis/command/vadd_multi",
            request
        );
        return response.result
    } catch (error) {
        console.error("[vadd_multi] API error:", error);
        // Re-throw the error to be caught by the caller
        throw error;
    }
}

// VLINKS command
export interface VlinksRequestBody {
    keyName: string;
    element: string;
    count?: number;
    withEmbeddings?: boolean;
}

export async function vlinks(request: VlinksRequestBody) {
    const response = await apiClient.post<VectorTupleLevels, VlinksRequestBody>(
        "/api/redis/command/vlinks",
        request
    );
    console.log("VLINKS response", response)
    return response
}

// VSIM command
export interface VsimRequestBody {
    keyName: string;
    searchVector?: number[];
    searchElement?: string;
    count: number;
    withEmbeddings?: boolean;
    filter?: string;
    expansionFactor?: number;
}
import { ApiResponse } from "@/app/api/client"

export interface VsimResponse extends ApiResponse {
    result?: VectorTuple[];
}

export async function vsim(request: VsimRequestBody): Promise<VsimResponse> {
    const response = await apiClient.post<
        VectorTuple[],
        VsimRequestBody
    >("/api/redis/command/vsim", request);

    return response
}

// VSETATTR command
export interface VsetAttrRequestBody {
    keyName: string;
    element: string;
    attributes: string;  // JSON string
}

export interface VsetAttrResponse {
    success: boolean;
    error?: string;
}

export async function vsetattr(request: VsetAttrRequestBody) {
    return apiClient.post<VsetAttrResponse, VsetAttrRequestBody>(
        "/api/redis/command/vsetattr",
        request
    );
}

// VGETATTR command
export interface VgetAttrRequestBody {
    keyName: string;
    element?: string;
    elements?: string[];
}

export async function vgetattr(request: VgetAttrRequestBody): Promise<string | null> {
    try {
        const response = await apiClient.post<string, VgetAttrRequestBody>(
            "/api/redis/command/vgetattr",
            request
        );
        return response.result || null
    } catch (error) {
        console.error("[vgetattr] error: ", error);
        return null;
    }
}

// VGETATTR for multiple elements
export async function vgetattr_multi(request: VgetAttrRequestBody): Promise<string[] | null> {
    try {
        const response = await apiClient.post<string[], VgetAttrRequestBody>(
            "/api/redis/command/vgetattr",
            request
        );
        return response.result || null
    } catch (error) {
        console.error("[vgetattr] error: ", error);
        return null;
    }
}

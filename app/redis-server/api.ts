import { VectorSetMetadata } from '@/app/embeddings/types/config';
import { apiClient } from "../api/client"

// Base API response type
export interface ApiResponse<T = unknown> {
    success: boolean;
    result?: T;
    error?: string;
    executionTimeMs?: number;
}

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
    return apiClient.post<VinfoResponse, VinfoRequestBody>(
        "/api/redis/command/vinfo",
        request
    );
}

// VDIM command
export interface VdimRequestBody {
    keyName: string;
}

export async function vdim(request: VdimRequestBody) {
    return apiClient.post<number, VdimRequestBody>(
        "/api/redis/command/vdim",
        request
    );
}

// VCARD command
export interface VcardRequestBody {
    keyName: string;
}

export async function vcard(request: VcardRequestBody) {
    return apiClient.post<number, VcardRequestBody>(
        "/api/redis/command/vcard",
        request
    );
}

// VREM command
export interface VremRequestBody {
    keyName: string;
    element: string;
}

export async function vrem(request: VremRequestBody) {
    return apiClient.post<boolean, VremRequestBody>(
        "/api/redis/command/vrem",
        request
    );
}

// VEMB command
export interface VembRequestBody {
    keyName: string;
    element?: string;
    elements?: string[];
}

export async function vemb(request: VembRequestBody) {
    return apiClient.post<number[], VembRequestBody>(
        "/api/redis/command/vemb",
        request
    );
}

// VADD command
export interface VaddRequestBody {
    keyName: string;
    element: string;
    vector: number[];
    attributes?: string;
    reduceDimensions?: number;
    useCAS?: boolean;
}

export async function vadd(request: VaddRequestBody) {
    try {
        return await apiClient.post<boolean, VaddRequestBody>(
            "/api/redis/command/vadd",
            request
        );
    } catch (error) {
        console.error("[vadd] API error:", error);
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
    return apiClient.post<VectorTupleLevels, VlinksRequestBody>(
        "/api/redis/command/vlinks",
        request
    );
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

export interface VsimResponse {
    result: VectorTuple[];
    executionTimeMs?: number;
    executedCommand?: string;
}

export async function vsim(request: VsimRequestBody): Promise<VsimResponse> {
    const response = await apiClient.post<
        { result: VectorTuple[]; executionTimeMs?: number; executedCommand?: string },
        VsimRequestBody
    >("/api/redis/command/vsim", request);

    // Return both the result and execution time
    return {
        result: response.result,
        executionTimeMs: response.executionTimeMs,
        executedCommand: response.executedCommand
    };
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
        return await apiClient.post<string, VgetAttrRequestBody>(
            "/api/redis/command/vgetattr",
            request
        );
    } catch (error) {
        console.error("[vgetattr] error: ", error);
        return null;
    }
}

// VGETATTR for multiple elements
export async function vgetattr_multi(request: VgetAttrRequestBody): Promise<string[] | null> {
    try {
        return await apiClient.post<string[], VgetAttrRequestBody>(
            "/api/redis/command/vgetattr",
            request
        );
    } catch (error) {
        console.error("[vgetattr] error: ", error);
        return null;
    }
}

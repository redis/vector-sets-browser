import { VectorSetMetadata } from '@/app/types/vectorSetMetaData';
import { apiClient } from './client';

// Vector set management types
export type VectorSetMetadataResponse = VectorSetMetadata;

export interface MemoryUsageResponse {
    bytes: number;
}

export interface VectorSetCreateRequestBody {
    name: string;
    dimensions: number;
    metadata?: VectorSetMetadata;
    customData?: { element: string; vector: number[] };
}

export interface VectorSetListResponse {
    success: boolean;
    result: string[];
    error?: string;
}

export interface SetMetadataRequestBody {
    name: string;
    metadata: VectorSetMetadata;
}

export const vectorSets = {
    async list(): Promise<VectorSetListResponse> {
        return apiClient.get("/api/vectorset")
    },

    async create(request: VectorSetCreateRequestBody
    ): Promise<void> {
        const encodedName = encodeURIComponent(request.name)
        return apiClient.post(`/api/vectorset/${encodedName}`, request)
    },

    async delete(name: string): Promise<void> {
        const encodedName = encodeURIComponent(name)
        return apiClient.delete(`/api/vectorset/${encodedName}`)
    },

    async getMetadata(
        name: string
    ): Promise<VectorSetMetadataResponse> {
        const encodedName = encodeURIComponent(name)
        return apiClient.get(`/api/vectorset/${encodedName}/metadata`)
    },

    async setMetadata(request: SetMetadataRequestBody): Promise<void> {
        const encodedName = encodeURIComponent(request.name)
        return apiClient.post(`/api/vectorset/${encodedName}/metadata`, request)
    },

    async getMemoryUsage(name: string): Promise<MemoryUsageResponse> {
        const encodedName = encodeURIComponent(name)
        return apiClient.get(`/api/vectorset/${encodedName}/memory`)
    },
} 
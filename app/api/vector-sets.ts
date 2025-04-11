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

export type VectorSetListResponse = string[] | null

export interface SetMetadataRequestBody {
    name: string;
    metadata: VectorSetMetadata;
}

export const vectorSets = {
    async list(): Promise<VectorSetListResponse> {
        const response = await apiClient.get<VectorSetListResponse>("/api/vectorset");
        return response.result || null
    },

    async create(request: VectorSetCreateRequestBody
    ): Promise<void> {
        const encodedName = encodeURIComponent(request.name)
        const response = await apiClient.post(`/api/vectorset/${encodedName}`, request)
        if (!response.success) {
            throw new Error(response.error || 'Failed to create vector set')
        }
    },

    async delete(name: string): Promise<void> {
        const encodedName = encodeURIComponent(name)
        apiClient.delete(`/api/vectorset/${encodedName}`)
    },

    async getMetadata(
        name: string
    ): Promise<VectorSetMetadataResponse | null> {
        const encodedName = encodeURIComponent(name)
        const response = await apiClient.get<VectorSetMetadataResponse>(`/api/vectorset/${encodedName}/metadata`)
        return response.result || null
    },

    async setMetadata(request: SetMetadataRequestBody): Promise<void> {
        const encodedName = encodeURIComponent(request.name)
        apiClient.post(`/api/vectorset/${encodedName}/metadata`, request)
    },

} 
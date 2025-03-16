import { apiClient } from './client';
import type { 
    VectorSetMetadataResponse, 
    MemoryUsageResponse, 
    VectorSetCreateRequest,
    VectorSetListResponse
} from './types';

export const vectorSets = {
    async list(): Promise<VectorSetListResponse> {
        return apiClient.get('/api/vectorset');
    },

    async create(setName: string, request: VectorSetCreateRequest): Promise<void> {
        const encodedName = encodeURIComponent(setName);
        return apiClient.post(`/api/vectorset/${encodedName}`, request);
    },

    async delete(setName: string): Promise<void> {
        const encodedName = encodeURIComponent(setName);
        return apiClient.delete(`/api/vectorset/${encodedName}`);
    },

    async getMetadata(vectorSetName: string): Promise<VectorSetMetadataResponse> {
        const encodedName = encodeURIComponent(vectorSetName);
        return apiClient.get(`/api/vectorset/${encodedName}/metadata`);
    },

    async getMemoryUsage(vectorSetName: string): Promise<MemoryUsageResponse> {
        const encodedName = encodeURIComponent(vectorSetName);
        return apiClient.get(`/api/vectorset/${encodedName}/memory`);
    }
}; 
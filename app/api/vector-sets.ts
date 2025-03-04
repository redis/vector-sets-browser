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
        return apiClient.post(`/api/vectorset/${setName}`, request);
    },

    async delete(setName: string): Promise<void> {
        return apiClient.delete(`/api/vectorset/${setName}`);
    },

    async getMetadata(vectorSetName: string): Promise<VectorSetMetadataResponse> {
        return apiClient.get(`/api/vectorset/${vectorSetName}/metadata`);
    },

    async getMemoryUsage(vectorSetName: string): Promise<MemoryUsageResponse> {
        return apiClient.get(`/api/vectorset/${vectorSetName}/memory`);
    }
}; 
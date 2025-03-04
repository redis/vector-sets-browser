import { apiClient } from './client';
import { EmbeddingRequest, EmbeddingResponse } from './types';
import { EmbeddingConfig } from '../types/embedding';

export const embeddings = {
    async getEmbedding(config: EmbeddingConfig, text?: string, imageData?: string) {
        return apiClient.post<EmbeddingResponse, EmbeddingRequest>(
            '/api/embedding',
            {
                text,
                imageData,
                config,
            }
        );
    }
}; 
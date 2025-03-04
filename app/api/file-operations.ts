import { apiClient } from './client';
import type { VectorSetMetadata } from '../types/embedding';

export interface FileValidationResponse {
    isValid: boolean;
    error?: string;
    preview?: {
        headers: string[];
        rows: string[][];
    };
}

export interface ImportConfig {
    delimiter: string;
    hasHeader: boolean;
    skipRows: number;
    textColumn: string;
    imageColumn?: string;
    metadata?: VectorSetMetadata;
}

export const fileOperations = {
    async validateImport(vectorSetName: string, file: File, config: ImportConfig): Promise<FileValidationResponse> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('config', JSON.stringify(config));
        
        return apiClient.post(`/api/vectorset/${vectorSetName}/importData/validate`, formData, true);
    },

    async importFile(vectorSetName: string, file: File, config: ImportConfig): Promise<{ jobId: string }> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('config', JSON.stringify(config));
        
        return apiClient.post(`/api/vectorset/${vectorSetName}/importData`, formData, true);
    }
}; 
import { apiClient } from './client';
import { CSVJobMetadata } from '@/app/types/job-queue'; 

export interface Job {
    jobId: string;
    status: {
        status: 'processing' | 'paused' | 'pending' | 'completed' | 'failed' | 'cancelled';
        current: number;
        total: number;
        message?: string;
        error?: string;
    };
    metadata: CSVJobMetadata;
}

export interface ImportLogEntry {
    jobId: string;
    timestamp: string;
    vectorSetName: string;
    filename: string;
    recordsProcessed: number;
    totalRecords: number;
    embeddingConfig: any;
    status: 'completed';
}

export interface ImportJobConfig {
    delimiter: string;
    hasHeader: boolean;
    skipRows: number;
    elementColumn: string;
    textColumn: string;
    elementTemplate?: string;
    textTemplate?: string;
    attributeColumns?: string[];
    metadata?: VectorSetMetadata;
}

export const jobs = {
    async getJob(jobId: string): Promise<Job> {
        return apiClient.get(`/api/jobs?jobId=${encodeURIComponent(jobId)}`);
    },

    async getJobsByVectorSet(vectorSetName: string): Promise<Job[]> {
        return apiClient.get(`/api/jobs?vectorSetName=${encodeURIComponent(vectorSetName)}`);
    },

    async pauseJob(jobId: string): Promise<void> {
        return apiClient.request(`/api/jobs?jobId=${encodeURIComponent(jobId)}&action=pause`, {
            method: 'PATCH'
        });
    },

    async resumeJob(jobId: string): Promise<void> {
        return apiClient.request(`/api/jobs?jobId=${encodeURIComponent(jobId)}&action=resume`, {
            method: 'PATCH'
        });
    },

    async cancelJob(jobId: string): Promise<void> {
        return apiClient.delete(`/api/jobs?jobId=${encodeURIComponent(jobId)}`);
    },
    
    async getImportLogs(vectorSetName?: string, limit: number = 10): Promise<ImportLogEntry[]> {
        let url = `/api/importlog?limit=${limit}`;
        if (vectorSetName) {
            url += `&vectorSetName=${encodeURIComponent(vectorSetName)}`;
        }
        return apiClient.get(url);
    },

    async createImportJob(vectorSetName: string, file: File, config: ImportJobConfig): Promise<{ jobId: string }> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('vectorSetName', vectorSetName);
        
        // Add individual config fields directly to FormData
        formData.append('delimiter', config.delimiter);
        formData.append('hasHeader', String(config.hasHeader));
        formData.append('skipRows', String(config.skipRows));
        formData.append('elementColumn', config.elementColumn);
        formData.append('textColumn', config.textColumn);
        
        // Add template fields if they exist
        if (config.elementTemplate) {
            formData.append('elementTemplate', config.elementTemplate);
        }
        if (config.textTemplate) {
            formData.append('textTemplate', config.textTemplate);
        }
        
        // Handle attribute columns array
        if (config.attributeColumns && config.attributeColumns.length > 0) {
            config.attributeColumns.forEach(column => {
                formData.append('attributeColumns', column);
            });
        }
        return apiClient.post(`/api/jobs`, formData);
    }
}; 
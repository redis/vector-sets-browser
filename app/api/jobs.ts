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
    }
}; 
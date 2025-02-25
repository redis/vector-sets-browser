import { EmbeddingConfig } from "./embedding";

export type JobStatus = 'pending' | 'processing' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface JobProgress {
    current: number;
    total: number;
    status: JobStatus;
    message?: string;
    error?: string;
}

export interface CSVJobMetadata {
    vectorSetName: string;
    filename: string;
    created: string;
    embedding: EmbeddingConfig;
}

export interface CSVRow {
    [key: string]: string;
}

export interface JobQueueItem {
    elementId: string;
    data: string;
}

// Redis key helpers
export const getJobQueueKey = (jobId: string) => `job:${jobId}:queue`;
export const getJobStatusKey = (jobId: string) => `job:${jobId}:status`;
export const getJobMetadataKey = (jobId: string) => `job:${jobId}:metadata`; 
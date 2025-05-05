import { EmbeddingConfig } from "@/lib/embeddings/types/embeddingModels"

export type JobStatus =
    | "pending"
    | "processing"
    | "paused"
    | "completed"
    | "failed"
    | "cancelled"

export interface JobProgress {
    current: number
    total: number
    status: JobStatus
    message?: string
    error?: string
    timestamp?: number
}

export interface CSVJobMetadata {
    jobId: string
    filename: string
    vectorSetName: string
    embedding: EmbeddingConfig
    elementColumn?: string
    textColumn?: string
    elementTemplate?: string
    textTemplate?: string
    attributeColumns?: string[]
    total: number
    delimiter?: string
    hasHeader?: boolean
    skipRows?: number
    fileType?: string
    exportType?: 'redis' | 'json'
    outputFilename?: string
}

export interface CSVRow {
    [key: string]: string | number
}

export interface JobQueueItem {
    jobId: string
    rowData: CSVRow
    index: number
}

// Redis key helpers
export const getJobQueueKey = (jobId: string) => `job:${jobId}:queue`
export const getJobStatusKey = (jobId: string) => `job:${jobId}:status`
export const getJobMetadataKey = (jobId: string) => `job:${jobId}:metadata`

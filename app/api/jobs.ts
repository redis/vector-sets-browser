import { CSVJobMetadata } from "@/app/types/job-queue"
import { VectorSetMetadata } from "@/app/types/vectorSetMetaData"

import { apiClient } from "./client"

export interface Job {
    jobId: string
    status: {
        status:
            | "processing"
            | "paused"
            | "pending"
            | "completed"
            | "failed"
            | "cancelled"
        current: number
        total: number
        message?: string
        error?: string
    }
    metadata: CSVJobMetadata
}

export interface ImportLogEntry {
    jobId: string
    timestamp: string
    vectorSetName: string
    filename: string
    recordsProcessed: number
    totalRecords: number
    embeddingConfig: any
    status: "completed"
}

export interface ImportJobConfig {
    delimiter?: string
    hasHeader?: boolean
    skipRows?: number
    elementColumn?: string
    textColumn?: string
    elementTemplate?: string
    textTemplate?: string
    attributeColumns?: string[]
    metadata?: VectorSetMetadata
    rawVectors?: number[][]
    fileType?: 'csv' | 'image' | 'images' | 'json'
    exportType?: 'redis' | 'json'
    outputFilename?: string
}

export const jobs = {
    async getJob(jobId: string): Promise<Job> {
        return apiClient.get(`/api/jobs?jobId=${encodeURIComponent(jobId)}`)
    },

    async getJobsByVectorSet(vectorSetName: string): Promise<Job[]> {
        return apiClient.get(
            `/api/jobs?vectorSetName=${encodeURIComponent(vectorSetName)}`
        )
    },

    async pauseJob(jobId: string): Promise<void> {
        return apiClient.request(
            `/api/jobs?jobId=${encodeURIComponent(jobId)}&action=pause`,
            {
                method: "PATCH",
            }
        )
    },

    async resumeJob(jobId: string): Promise<void> {
        return apiClient.request(
            `/api/jobs?jobId=${encodeURIComponent(jobId)}&action=resume`,
            {
                method: "PATCH",
            }
        )
    },

    async cancelJob(jobId: string): Promise<void> {
        return apiClient.delete(`/api/jobs?jobId=${encodeURIComponent(jobId)}`)
    },

    async getImportLogs(
        vectorSetName?: string,
        limit: number = 10
    ): Promise<ImportLogEntry[]> {
        let url = `/api/importlog?limit=${limit}`
        if (vectorSetName) {
            url += `&vectorSetName=${encodeURIComponent(vectorSetName)}`
        }
        return apiClient.get(url)
    },

    async createImportJob(
        vectorSetName: string,
        file: File,
        config: ImportJobConfig
    ): Promise<{ jobId: string }> {
        // Convert file to base64 for JSON transport
        const fileContent = await file.text();
        
        // Create the request body
        const requestBody = {
            vectorSetName,
            fileContent,
            fileName: file.name,
            config: {
                ...config,
                // Ensure we have the filename in the config
                fileName: file.name
            }
        };

        return apiClient.post(`/api/jobs`, requestBody);
    },
}

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

export interface CreateImportJobRequestBody {
    vectorSetName: string
    fileContent: string
    fileName: string
    config: ImportJobConfig
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
    async getJob(jobId: string): Promise<Job | null> {
        const response = await apiClient.get<Job>(`/api/jobs?jobId=${encodeURIComponent(jobId)}`)
        return response.result || null
    },

    async getJobsByVectorSet(vectorSetName: string): Promise<Job[]> {
        const response = await apiClient.get<Job[]>(
            `/api/jobs?vectorSetName=${encodeURIComponent(vectorSetName)}`
        )
        return response.result || []
    },

    async pauseJob(jobId: string): Promise<void> {
        await apiClient.request(
            `/api/jobs?jobId=${encodeURIComponent(jobId)}&action=pause`,
            {
                method: "PATCH",
            }
        )
    },

    async resumeJob(jobId: string): Promise<void> {
        await apiClient.request(
            `/api/jobs?jobId=${encodeURIComponent(jobId)}&action=resume`,
            {
                method: "PATCH",
            }
        )
    },

    async cancelJob(jobId: string): Promise<void> {
        await apiClient.delete(`/api/jobs?jobId=${encodeURIComponent(jobId)}`)
    },

    async getImportLogs(
        vectorSetName?: string,
        limit: number = 10
    ): Promise<ImportLogEntry[]> {
        let url = `/api/importlog?limit=${limit}`
        if (vectorSetName) {
            url += `&vectorSetName=${encodeURIComponent(vectorSetName)}`
        }
        const response = await apiClient.get<ImportLogEntry[]>(url)
        return response.result || []
    },

    async createImportJob(
        vectorSetName: string,
        file: File,
        config: ImportJobConfig
    ): Promise<{ jobId: string }> {
        // Convert file to base64 for JSON transport
        const fileContent = await file.text();
        
        // Create the request body
        const requestBody: CreateImportJobRequestBody = {
            vectorSetName,
            fileContent,
            fileName: file.name,
            config,
        }

        const response = await apiClient.post<
            { jobId: string },
            CreateImportJobRequestBody
        >(`/api/jobs`, requestBody)
        return response.result || { jobId: "" }
    },
}

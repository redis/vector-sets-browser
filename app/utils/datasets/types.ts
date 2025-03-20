import { VectorSetMetadata } from "@/app/embeddings/types/config"

export interface PrecomputedVector {
    element: string
    vector: number[]
    attributes?: Record<string, string>
}

export interface DatasetImportOptions {
    vectorSetName: string
    chunkSize?: number
    onProgress?: (current: number, total: number) => void
    metadata?: VectorSetMetadata
}

export interface DatasetImportResult {
    success: boolean
    vectorSetName: string
    recordCount: number
    error?: string
}

export interface SampleDatasetImporter {
    name: string
    description: string
    importDataset: (options: DatasetImportOptions) => Promise<DatasetImportResult>
} 
import { EmbeddingConfig } from "@/lib/embeddings/types/embeddingModels"
import { ImportJobConfig } from "@/app/api/jobs"
import { ComponentType, FC } from "react"

export type DatasetType = "text" | "image"
export type EmbeddingType = "text" | "image"

export interface DatasetMetadata {
    name: string
    description: string
    icon: FC
    recordCount: number
    dataType: DatasetType
    embeddingType: EmbeddingType
    recommendedEmbedding: EmbeddingConfig
    previewComponent?: ComponentType<{ dataset: Dataset }>
}

export interface ImportProgress {
    current: number
    total: number
    status?: string
}

export interface Dataset extends DatasetMetadata {
    /**
     * Get the configuration for the import job
     */
    getImportConfig(): Promise<ImportJobConfig>

    /**
     * Prepare the data for import. This might involve:
     * - Fetching and processing CSV files
     * - Loading and processing images
     * - Computing embeddings
     */
    prepareImport(options: {
        count?: number // Optional limit on number of items to import
        onProgress?: (progress: ImportProgress) => void
    }): Promise<{
        file: File
        config: ImportJobConfig
    }>

    /**
     * Get a preview of the data (optional)
     */
    getPreview?(): Promise<unknown>

    /**
     * Validate that the current embedding configuration is compatible
     */
    validateEmbedding(config: EmbeddingConfig): boolean
}

export interface DatasetProviderProps {
    dataset: Dataset
    vectorSetName: string
    onProgress?: (progress: ImportProgress) => void
    onError?: (error: Error) => void
    onComplete?: () => void
}

export interface DatasetProvider {
    /**
     * Get all available datasets from this provider
     */
    getDatasets(): Dataset[]

    /**
     * Create a dataset instance
     */
    createDataset(metadata: DatasetMetadata): Dataset
} 
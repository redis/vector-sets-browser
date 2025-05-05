import { EmbeddingConfig } from "./embeddingModels"

// Embedding API types
export interface EmbeddingRequestBody {
    text?: string
    imageData?: string
    config: EmbeddingConfig
}

export type EmbeddingResponse = number[]

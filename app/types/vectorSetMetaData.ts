import { EmbeddingConfig, getModelData } from "@/app/embeddings/types/embeddingModels";

export interface VectorSetAdvancedConfig {
    reduceDimensions?: number // If set, reduces vector dimensions using random projection
    defaultCAS?: boolean // Default value for Check-and-Set operations
    quantization?: "Q8" | "BIN" | "NOQUANT" // Vector quantization mode
    buildExplorationFactor?: number // EF build exploration factor
}

export interface VectorSetMetadata {
    embedding: EmbeddingConfig
    created?: string
    description?: string
    lastUpdated?: string
    totalVectors?: number
    dimensions?: number
    redisConfig?: VectorSetAdvancedConfig
}

export function createVectorSetMetadata(
    config: EmbeddingConfig,
    description?: string
): VectorSetMetadata {
    const modelData = getModelData(config)

    return {
        embedding: config,
        created: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        description,
        dimensions: modelData?.dimensions,
    }
}

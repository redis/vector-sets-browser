import { EmbeddingConfig, getModelData } from "@/lib/embeddings/types/embeddingModels";
import { SearchType } from "@/components/SearchOptions/SearchTypeSelector";

export interface VectorSetAdvancedConfig {
    reduceDimensions?: number // If set, reduces vector dimensions using random projection
    defaultCAS?: boolean // Default value for Check-and-Set operations
    quantization?: "Q8" | "BIN" | "NOQUANT" // Vector quantization mode
    buildExplorationFactor?: number // EF build exploration factor (VADD)
    maxConnections?: number // Maximum number of connections per node (default: 16) (This is the M parameter)
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

// New interface for search options that combines VectorSetAdvancedConfig parameters with search state
export interface VectorSetSearchOptions {
    searchType: SearchType
    searchQuery: string
    searchCount: string
    searchFilter: string
    resultsTitle: string
    searchTime?: string
    searchExplorationFactor?: number
    filterExplorationFactor?: number
    forceLinearScan: boolean
    noThread: boolean
    lastTextEmbedding?: number[]
    executedCommand?: string
    vectorFormat?: 'FP32' | 'VALUES'
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

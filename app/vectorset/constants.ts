import { EmbeddingProvider } from "@/app/embeddings/types/embeddingModels";

/**
 * Vector Set Constants
 * Contains common constants used throughout the vector set functionality
 */

// Default embedding provider and model settings
export const DEFAULT_EMBEDDING = {
    PROVIDER: "none" as EmbeddingProvider,
    MODEL: "custom",
    DIMENSIONS: 1536,
}

export const DEFAULT_EMBEDDING_CONFIG = {
    provider: DEFAULT_EMBEDDING.PROVIDER,
    none: {
        model: DEFAULT_EMBEDDING.MODEL,
        dimensions: DEFAULT_EMBEDDING.DIMENSIONS,
    },
}
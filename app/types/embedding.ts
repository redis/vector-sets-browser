export type EmbeddingProvider =
    | "openai"
    | "ollama"
    | "tensorflow"
    | "image"
    | "none"

export type OpenAIModel =
    | "text-embedding-3-small"
    | "text-embedding-3-large"
    | "text-embedding-ada-002"

export interface OpenAIConfig {
    apiKey: string
    model: OpenAIModel
    dimensions?: number // Optional - will be determined by model if not specified
    batchSize?: number // For batch processing
}

export interface OllamaConfig {
    apiUrl: string
    modelName: string
    promptTemplate?: string
}

export type TensorFlowModel =
    | "universal-sentence-encoder"
    | "universal-sentence-encoder-lite"
    | "universal-sentence-encoder-multilingual"

export interface TensorFlowConfig {
    model: TensorFlowModel
}

// For now, we only support MobileNet due to dependency conflicts
export type ImageModel = "mobilenet" // | 'efficientnet' | 'resnet50';

export interface ImageConfig {
    model: ImageModel
    inputSize?: number // Optional - size to resize images to before embedding
}

export interface EmbeddingConfig {
    provider: EmbeddingProvider
    openai?: OpenAIConfig
    ollama?: OllamaConfig
    tensorflow?: TensorFlowConfig
    image?: ImageConfig
    none?: NoEmbeddingConfig
}

export interface NoEmbeddingConfig {
    model: string
    dimensions: number
}

export interface VectorSetMetadata {
    embedding: EmbeddingConfig
    created: string
    description?: string
    lastUpdated?: string
    totalVectors?: number
    dimensions?: number
    redisConfig?: {
        reduceDimensions?: number  // If set, reduces vector dimensions using random projection
        defaultCAS?: boolean      // Default value for Check-and-Set operations
        quantization?: 'Q8' | 'BIN' | 'NOQUANT'  // Vector quantization mode
        buildExplorationFactor?: number  // EF build exploration factor
    }
}

export const MODEL_DIMENSIONS = {
    "text-embedding-3-small": 1536,
    "text-embedding-3-large": 3072,
    "text-embedding-ada-002": 1536,
    "universal-sentence-encoder": 512,
    "universal-sentence-encoder-lite": 512,
    "universal-sentence-encoder-multilingual": 512,
    mobilenet: 1024,
    // 'efficientnet': 1280,
    // 'resnet50': 2048
} as const

export function createVectorSetMetadata(
    config: EmbeddingConfig,
    description?: string
): VectorSetMetadata {
    let dimensions: number | undefined

    if (config.provider === "openai" && config.openai?.model) {
        dimensions = MODEL_DIMENSIONS[config.openai.model]
    } else if (config.provider === "tensorflow" && config.tensorflow?.model) {
        dimensions = MODEL_DIMENSIONS[config.tensorflow.model]
    } else if (config.provider === "image" && config.image?.model) {
        dimensions = MODEL_DIMENSIONS[config.image.model]
    } else if (config.provider === "none" && config.none?.model) {
        dimensions = 3 // default dimensions for none
    }

    return {
        embedding: config,
        created: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        description,
        dimensions,
    }
}

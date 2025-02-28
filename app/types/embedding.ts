export type EmbeddingProvider =
    | "openai"
    | "ollama"
    | "tensorflow"
    | "image"
    | "none"

export type EmbeddingDataFormat = "text" | "image"

// Define a ModelData interface to replace string model types
export interface ModelData {
    name: string
    dimensions: number
    dataFormat: EmbeddingDataFormat
}

// Define model data for OpenAI models
export const OPENAI_MODELS: Record<string, ModelData> = {
    "text-embedding-3-small": {
        name: "text-embedding-3-small",
        dimensions: 1536,
        dataFormat: "text"
    },
    "text-embedding-3-large": {
        name: "text-embedding-3-large",
        dimensions: 3072,
        dataFormat: "text"
    },
    "text-embedding-ada-002": {
        name: "text-embedding-ada-002",
        dimensions: 1536,
        dataFormat: "text"
    }
}

// Define model data for TensorFlow models
export const TENSORFLOW_MODELS: Record<string, ModelData> = {
    "universal-sentence-encoder": {
        name: "universal-sentence-encoder",
        dimensions: 512,
        dataFormat: "text"
    },
    "universal-sentence-encoder-lite": {
        name: "universal-sentence-encoder-lite",
        dimensions: 512,
        dataFormat: "text"
    },
    "universal-sentence-encoder-multilingual": {
        name: "universal-sentence-encoder-multilingual",
        dimensions: 512,
        dataFormat: "text"
    }
}

// Define model data for Image models
export const IMAGE_MODELS: Record<string, ModelData> = {
    "mobilenet": {
        name: "mobilenet",
        dimensions: 1024,
        dataFormat: "image"
    }
    // Uncomment when supported
    // "efficientnet": {
    //     name: "efficientnet",
    //     dimensions: 1280,
    //     dataFormat: "image"
    // },
    // "resnet50": {
    //     name: "resnet50",
    //     dimensions: 2048,
    //     dataFormat: "image"
    // }
}

// Define model data for Ollama models
export const OLLAMA_MODELS: Record<string, ModelData> = {
    "mxbai-embed-large": {
        name: "mxbai-embed-large",
        dimensions: 1024,
        dataFormat: "text"
    },
    "mxbai-embed-small": {
        name: "mxbai-embed-small",
        dimensions: 384,
        dataFormat: "text"
    },
    "nomic-embed-text": {
        name: "nomic-embed-text",
        dimensions: 768,
        dataFormat: "text"
    },
    "all-minilm": {
        name: "all-minilm",
        dimensions: 384,
        dataFormat: "text"
    }
}

// Type for OpenAI model names
export type OpenAIModelName = keyof typeof OPENAI_MODELS

// Type for TensorFlow model names
export type TensorFlowModelName = keyof typeof TENSORFLOW_MODELS

// Type for Image model names
export type ImageModelName = keyof typeof IMAGE_MODELS

export interface OpenAIConfig {
    apiKey: string
    model: OpenAIModelName
    batchSize?: number // For batch processing
}

export interface OllamaConfig {
    apiUrl: string
    modelName: string
    promptTemplate?: string
}

export interface TensorFlowConfig {
    model: TensorFlowModelName
}

export interface ImageConfig {
    model: ImageModelName
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

// Helper function to get model data for any model
export function getModelData(config: EmbeddingConfig): ModelData | undefined {
    if (config.provider === "openai" && config.openai?.model) {
        return OPENAI_MODELS[config.openai.model];
    } else if (config.provider === "tensorflow" && config.tensorflow?.model) {
        return TENSORFLOW_MODELS[config.tensorflow.model];
    } else if (config.provider === "image" && config.image?.model) {
        return IMAGE_MODELS[config.image.model];
    } else if (config.provider === "ollama" && config.ollama?.modelName) {
        return OLLAMA_MODELS[config.ollama.modelName as keyof typeof OLLAMA_MODELS] || {
            name: config.ollama.modelName,
            dimensions: 1024, // Default dimensions for unknown Ollama models
            dataFormat: "text" // Default data format for Ollama models
        };
    } else if (config.provider === "none" && config.none?.model) {
        return {
            name: config.none.model,
            dimensions: config.none.dimensions,
            dataFormat: "text" // Default data format for none provider
        };
    }
    return undefined;
}

export function createVectorSetMetadata(
    config: EmbeddingConfig,
    description?: string
): VectorSetMetadata {
    const modelData = getModelData(config);
    
    return {
        embedding: config,
        created: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        description,
        dimensions: modelData?.dimensions,
    }
}

// Helper function to get model name for a given embedding config
export function getModelName(config: EmbeddingConfig): string {
    const modelData = getModelData(config);
    return modelData?.name || "Unknown Model";
}

export function getProvider(config: EmbeddingConfig): EmbeddingProvider {
    return config.provider;
}

// Helper function to get data format for a given embedding config
export function getEmbeddingDataFormat(config: EmbeddingConfig): EmbeddingDataFormat {
    const modelData = getModelData(config);
    return modelData?.dataFormat || "text"; // Default to text if not specified
}

// Helper function to check if an embedding config is for image data
export function isImageEmbedding(config: EmbeddingConfig): boolean {
    return getEmbeddingDataFormat(config) === "image";
}

// Helper function to check if an embedding config is for text data
export function isTextEmbedding(config: EmbeddingConfig): boolean {
    return getEmbeddingDataFormat(config) === "text";
}

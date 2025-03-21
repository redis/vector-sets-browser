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
        dataFormat: "text",
    },
    "text-embedding-3-large": {
        name: "text-embedding-3-large",
        dimensions: 3072,
        dataFormat: "text",
    },
    "text-embedding-ada-002": {
        name: "text-embedding-ada-002",
        dimensions: 1536,
        dataFormat: "text",
    },
}

// Define model data for TensorFlow models
export const TENSORFLOW_MODELS: Record<string, ModelData> = {
    "universal-sentence-encoder": {
        name: "universal-sentence-encoder",
        dimensions: 512,
        dataFormat: "text",
    },
    "universal-sentence-encoder-lite": {
        name: "universal-sentence-encoder-lite",
        dimensions: 512,
        dataFormat: "text",
    },
    "universal-sentence-encoder-multilingual": {
        name: "universal-sentence-encoder-multilingual",
        dimensions: 512,
        dataFormat: "text",
    },
}

// Define model data for Image models
export const IMAGE_MODELS: Record<string, ModelData> = {
    mobilenet: {
        name: "mobilenet",
        dimensions: 1024,
        dataFormat: "image",
    },
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
        dataFormat: "text",
    },
    "mxbai-embed-small": {
        name: "mxbai-embed-small",
        dimensions: 384,
        dataFormat: "text",
    },
    "nomic-embed-text": {
        name: "nomic-embed-text",
        dimensions: 768,
        dataFormat: "text",
    },
    "all-minilm": {
        name: "all-minilm",
        dimensions: 384,
        dataFormat: "text",
    },
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
    created?: string
    description?: string
    lastUpdated?: string
    totalVectors?: number
    dimensions?: number
    redisConfig?: {
        reduceDimensions?: number // If set, reduces vector dimensions using random projection
        defaultCAS?: boolean // Default value for Check-and-Set operations
        quantization?: "Q8" | "BIN" | "NOQUANT" // Vector quantization mode
        buildExplorationFactor?: number // EF build exploration factor
    }
}

// Helper function to get model data for any model
export function getModelData(config: EmbeddingConfig): ModelData | undefined {
    // Check if config is null/undefined or if provider property doesn't exist
    if (!config || !("provider" in config)) {
        return undefined
    }

    // Alternative approach using optional chaining and nullish coalescing
    // const provider = config?.provider ?? 'none';

    if (config.provider === "openai" && config.openai?.model) {
        return OPENAI_MODELS[config.openai.model]
    } else if (config.provider === "tensorflow" && config.tensorflow?.model) {
        return TENSORFLOW_MODELS[config.tensorflow.model]
    } else if (config.provider === "image" && config.image?.model) {
        return IMAGE_MODELS[config.image.model]
    } else if (config.provider === "ollama" && config.ollama?.modelName) {
        return (
            OLLAMA_MODELS[
                config.ollama.modelName as keyof typeof OLLAMA_MODELS
            ] || {
                name: config.ollama.modelName,
                dimensions: 1024, // Default dimensions for unknown Ollama models
                dataFormat: "text", // Default data format for Ollama models
            }
        )
    } else if (config.provider === "none" && config.none?.model) {
        return {
            name: config.none.model,
            dimensions: config.none.dimensions,
            dataFormat: "text", // Default data format for none provider
        }
    }
    return undefined
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

// Helper function to get model name for a given embedding config
export function getModelName(config: EmbeddingConfig): string {
    const modelData = getModelData(config)
    return modelData?.name || "Unknown Model"
}

export function getProvider(config: EmbeddingConfig): EmbeddingProvider {
    return config.provider
}

// Helper function to get data format for a given embedding config
export function getEmbeddingDataFormat(
    config: EmbeddingConfig
): EmbeddingDataFormat {
    const modelData = getModelData(config)
    return modelData?.dataFormat || "text" // Default to text if not specified
}

// Helper function to check if an embedding config is for image data
export function isImageEmbedding(config: EmbeddingConfig): boolean {
    return getEmbeddingDataFormat(config) === "image"
}

// Helper function to check if an embedding config is for text data
export function isTextEmbedding(config: EmbeddingConfig): boolean {
    return getEmbeddingDataFormat(config) === "text"
}

/**
 * Validates and corrects metadata read from Redis
 * Ensures it matches the expected VectorSetMetadata structure
 * @param data The data read from Redis
 * @returns Corrected VectorSetMetadata
 */
export function validateAndCorrectMetadata(data: unknown): VectorSetMetadata {
    // Create a base metadata object with required fields
    const correctedMetadata: VectorSetMetadata = {
        embedding: {
            provider: "none",
            none: {
                model: "unknown",
                dimensions: 0,
            },
        },
        created: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
    }

    // If data is null or not an object, return the base metadata
    if (!data || typeof data !== "object") {
        return correctedMetadata
    }

    // Type assertion after checking it's an object
    const typedData = data as Record<string, unknown>

    // Check and correct embedding configuration
    if (typedData.embedding && typeof typedData.embedding === "object") {
        const embeddingData = typedData.embedding as Record<string, unknown>

        // Check if provider exists and is valid
        if (
            "provider" in embeddingData &&
            typeof embeddingData.provider === "string" &&
            ["openai", "ollama", "tensorflow", "image", "none"].includes(
                embeddingData.provider
            )
        ) {
            correctedMetadata.embedding.provider =
                embeddingData.provider as EmbeddingProvider

            // Copy the provider-specific config if it exists
            switch (embeddingData.provider) {
                case "openai":
                    if (
                        embeddingData.openai &&
                        typeof embeddingData.openai === "object"
                    ) {
                        const openaiData = embeddingData.openai as Record<
                            string,
                            unknown
                        >
                        correctedMetadata.embedding.openai = {
                            apiKey:
                                typeof openaiData.apiKey === "string"
                                    ? openaiData.apiKey
                                    : "",
                            model:
                                typeof openaiData.model === "string"
                                    ? openaiData.model
                                    : "text-embedding-3-small",
                        }
                        if (typeof openaiData.batchSize === "number") {
                            correctedMetadata.embedding.openai.batchSize =
                                openaiData.batchSize
                        }
                    }
                    break
                case "ollama":
                    if (
                        embeddingData.ollama &&
                        typeof embeddingData.ollama === "object"
                    ) {
                        const ollamaData = embeddingData.ollama as Record<
                            string,
                            unknown
                        >
                        correctedMetadata.embedding.ollama = {
                            apiUrl:
                                typeof ollamaData.apiUrl === "string"
                                    ? ollamaData.apiUrl
                                    : "http://localhost:11434",
                            modelName:
                                typeof ollamaData.modelName === "string"
                                    ? ollamaData.modelName
                                    : "all-minilm",
                        }
                        if (typeof ollamaData.promptTemplate === "string") {
                            correctedMetadata.embedding.ollama.promptTemplate =
                                ollamaData.promptTemplate
                        }
                    }
                    break
                case "tensorflow":
                    if (
                        embeddingData.tensorflow &&
                        typeof embeddingData.tensorflow === "object"
                    ) {
                        const tensorflowData =
                            embeddingData.tensorflow as Record<string, unknown>
                        correctedMetadata.embedding.tensorflow = {
                            model:
                                typeof tensorflowData.model === "string"
                                    ? (tensorflowData.model as TensorFlowModelName)
                                    : "universal-sentence-encoder",
                        }
                    }
                    break
                case "image":
                    if (
                        embeddingData.image &&
                        typeof embeddingData.image === "object"
                    ) {
                        const imageData = embeddingData.image as Record<
                            string,
                            unknown
                        >
                        correctedMetadata.embedding.image = {
                            model:
                                typeof imageData.model === "string"
                                    ? (imageData.model as ImageModelName)
                                    : "mobilenet",
                        }
                        if (typeof imageData.inputSize === "number") {
                            correctedMetadata.embedding.image.inputSize =
                                imageData.inputSize
                        }
                    }
                    break
                case "none":
                    if (
                        embeddingData.none &&
                        typeof embeddingData.none === "object"
                    ) {
                        const noneData = embeddingData.none as Record<
                            string,
                            unknown
                        >
                        correctedMetadata.embedding.none = {
                            model:
                                typeof noneData.model === "string"
                                    ? noneData.model
                                    : "unknown",
                            dimensions:
                                typeof noneData.dimensions === "number"
                                    ? noneData.dimensions
                                    : 0,
                        }
                    }
                    break
            }
        }
    }

    // Copy other metadata fields if they exist
    if (typeof typedData.created === "string") {
        correctedMetadata.created = typedData.created
    }

    if (typeof typedData.lastUpdated === "string") {
        correctedMetadata.lastUpdated = typedData.lastUpdated
    } else {
        correctedMetadata.lastUpdated = correctedMetadata.created
    }

    if (typeof typedData.description === "string") {
        correctedMetadata.description = typedData.description
    }

    if (typeof typedData.totalVectors === "number") {
        correctedMetadata.totalVectors = typedData.totalVectors
    }

    // Get dimensions from model data or use provided dimensions
    const modelData = getModelData(correctedMetadata.embedding)
    correctedMetadata.dimensions =
        modelData?.dimensions ||
        (typeof typedData.dimensions === "number" ? typedData.dimensions : 0)

    // Copy Redis config if it exists
    if (typedData.redisConfig && typeof typedData.redisConfig === "object") {
        const redisConfigData = typedData.redisConfig as Record<string, unknown>
        correctedMetadata.redisConfig = {}

        if (typeof redisConfigData.reduceDimensions === "number") {
            correctedMetadata.redisConfig.reduceDimensions =
                redisConfigData.reduceDimensions
        }

        if (typeof redisConfigData.defaultCAS === "boolean") {
            correctedMetadata.redisConfig.defaultCAS =
                redisConfigData.defaultCAS
        }

        if (
            typeof redisConfigData.quantization === "string" &&
            ["Q8", "BIN", "NOQUANT"].includes(redisConfigData.quantization)
        ) {
            correctedMetadata.redisConfig.quantization =
                redisConfigData.quantization as "Q8" | "BIN" | "NOQUANT"
        }

        if (typeof redisConfigData.buildExplorationFactor === "number") {
            correctedMetadata.redisConfig.buildExplorationFactor =
                redisConfigData.buildExplorationFactor
        }
    }

    return correctedMetadata
}

// Helper function to get the expected dimensions for a given embedding config
export function getExpectedDimensions(config: EmbeddingConfig): number {
    // First try to get dimensions from model data

    const modelData = getModelData(config);
    if (modelData) {
        console.log(`[getExpectedDimensions] Model data: ${JSON.stringify(modelData)}`)
        return modelData.dimensions;
    }
    
    // If no model data is available, try to get dimensions directly from the provider config
    switch (config.provider) {
        case "none":
            return config.none?.dimensions || 0;
        case "openai":
            // For OpenAI, we need to look up the model dimensions from the model name
            const modelName = config.openai?.model;
            console.log(`[getExpectedDimensions] Model name: ${modelName}`)
            return modelName && OPENAI_MODELS[modelName]?.dimensions || 0;
        case "ollama":
            // For Ollama, check if the model name is in our known models
            const ollamaModelName = config.ollama?.modelName;
            console.log(`[getExpectedDimensions] Ollama model name: ${ollamaModelName}`)
            return ollamaModelName && 
                OLLAMA_MODELS[ollamaModelName as keyof typeof OLLAMA_MODELS]?.dimensions || 0;
        case "tensorflow":
            // For TensorFlow, check if the model name is in our known models
            const tfModelName = config.tensorflow?.model;
            console.log(`[getExpectedDimensions] TensorFlow model name: ${tfModelName}`)
            return tfModelName && 
                TENSORFLOW_MODELS[tfModelName]?.dimensions || 0;
        case "image":
            // For Image models, check if the model name is in our known models
            const imageModelName = config.image?.model;
            console.log(`[getExpectedDimensions] Image model name: ${imageModelName}`)
            return imageModelName && 
                IMAGE_MODELS[imageModelName]?.dimensions || 0;
        default:
            return 0;
    }
}

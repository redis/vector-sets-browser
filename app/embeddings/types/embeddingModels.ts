export type EmbeddingProvider =
    | "openai"
    | "ollama"
    | "tensorflow"
    | "image"
    | "clip"
    | "none"

export type EmbeddingDataFormat = "text" | "image" | "text-and-image"

// Define a ModelData interface to replace string model types
export interface ModelData {
    name: string
    dimensions: number
    dataFormat: EmbeddingDataFormat
    modelPath?: string // Optional path to the model, used for models like CLIP
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
    }
    // Uncomment when supported
    // "efficientnet": {...},
    // "resnet50": {...}
}

// Define model data for CLIP models
export const CLIP_MODELS: Record<string, ModelData> = {
    "clip-vit-base-patch32": {
        name: "clip-vit-base-patch32",
        dimensions: 512,
        dataFormat: "image",
        modelPath: "Xenova/clip-vit-base-patch32"
    }
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

// Update the ImageModelName type to remove CLIP
export type ImageModelName = "mobilenet"

// Add a new type for CLIP models
export type ClipModelName = keyof typeof CLIP_MODELS

export interface OpenAIConfig {
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
    modelPath?: string // Optional - path to the model, used for CLIP
}

export interface ClipConfig {
    model: ClipModelName
}

export interface EmbeddingConfig {
    provider: EmbeddingProvider
    openai?: OpenAIConfig
    ollama?: OllamaConfig
    tensorflow?: TensorFlowConfig
    image?: ImageConfig
    clip?: ClipConfig
    none?: NoEmbeddingConfig
}

export interface NoEmbeddingConfig {
    model: string
    dimensions: number
}

// Helper function to get model data for any model
export function getModelData(config: EmbeddingConfig): ModelData | undefined {
    // Check if config is null/undefined or if provider property doesn't exist
    if (!config || !("provider" in config)) {
        return undefined
    }

    if (config.provider === "openai" && config.openai?.model) {
        return OPENAI_MODELS[config.openai.model]
    } else if (config.provider === "tensorflow" && config.tensorflow?.model) {
        return TENSORFLOW_MODELS[config.tensorflow.model]
    } else if (config.provider === "image" && config.image?.model) {
        return IMAGE_MODELS[config.image.model]
    } else if (config.provider === "clip" && config.clip?.model) {
        return CLIP_MODELS[config.clip.model]
    } else if (config.provider === "ollama" && config.ollama?.modelName) {
        return (
            OLLAMA_MODELS[
                config.ollama.modelName as keyof typeof OLLAMA_MODELS
            ] || {
                name: config.ollama.modelName,
                dimensions: 1024,
                dataFormat: "text",
            }
        )
    } else if (config.provider === "none" && config.none?.model) {
        return {
            name: config.none.model,
            dimensions: config.none.dimensions,
            dataFormat: "text",
        }
    }
    return undefined
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
export function getEmbeddingDataFormat(config?: EmbeddingConfig): EmbeddingDataFormat {
    if (!config) {
        // console.log(`[getEmbeddingDataFormat] No config - returning text`)
        return "text"; // default to text if no config
    }

    // If it's a CLIP model, return text-and-image
    if (config.provider === "clip") {
        // console.log(`[getEmbeddingDataFormat] CLIP model - returning text-and-image`)
        return "text-and-image";
    }
    
    // Check for image provider or model
    if (config.provider === "image" || config.image?.model) {
        // console.log(`[getEmbeddingDataFormat] Image model - returning image`)
        return "image";
    }
    
    // console.log(`[getEmbeddingDataFormat] No CLIP or image - returning text`, config)
    return "text";
}

// Helper function to check if an embedding config is for image data
export function isImageEmbedding(config?: EmbeddingConfig): boolean {
    if (!config) {
        return false;
    }
    const format = getEmbeddingDataFormat(config);
    return format === "image" || format === "text-and-image";
}

// Helper function to check if an embedding config is for text data
export function isTextEmbedding(config?: EmbeddingConfig): boolean {
    if (!config) {
        return true; // default to true for text
    }
    const format = getEmbeddingDataFormat(config);
    return format === "text" || format === "text-and-image";
}

// Add the isMultiModalEmbedding function
export function isMultiModalEmbedding(config?: EmbeddingConfig): boolean {
    if (!config) {
        return false; // default to false if no config
    }
    const format = getEmbeddingDataFormat(config);
    // console.log(`[isMultiModalEmbedding] Format: ${format}`)
    return format === "text-and-image";
}

// Helper function to get the expected dimensions for a given embedding config
export function getExpectedDimensions(config: EmbeddingConfig): number {
    // First try to get dimensions from model data
    const modelData = getModelData(config);
    if (modelData) {
        // console.log(`[getExpectedDimensions] Model data: ${JSON.stringify(modelData)}`)
        return modelData.dimensions;
    }
    
    // If no model data is available, try to get dimensions directly from the provider config
    switch (config.provider) {
        case "clip":
            const clipModelName = config.clip?.model;
            return clipModelName && CLIP_MODELS[clipModelName]?.dimensions || 0;
        case "none":
            return config.none?.dimensions || 0;
        case "openai":
            // For OpenAI, we need to look up the model dimensions from the model name
            const modelName = config.openai?.model;
            // console.log(`[getExpectedDimensions] Model name: ${modelName}`)
            return modelName && OPENAI_MODELS[modelName]?.dimensions || 0;
        case "ollama":
            // For Ollama, check if the model name is in our known models
            const ollamaModelName = config.ollama?.modelName;
            // console.log(`[getExpectedDimensions] Ollama model name: ${ollamaModelName}`)
            return ollamaModelName && 
                OLLAMA_MODELS[ollamaModelName as keyof typeof OLLAMA_MODELS]?.dimensions || 0;
        case "tensorflow":
            // For TensorFlow, check if the model name is in our known models
            const tfModelName = config.tensorflow?.model;
            // console.log(`[getExpectedDimensions] TensorFlow model name: ${tfModelName}`)
            return tfModelName && 
                TENSORFLOW_MODELS[tfModelName]?.dimensions || 0;
        case "image":
            // For Image models, check if the model name is in our known models
            const imageModelName = config.image?.model;
            // console.log(`[getExpectedDimensions] Image model name: ${imageModelName}`)
            return imageModelName && 
                IMAGE_MODELS[imageModelName]?.dimensions || 0;
        default:
            return 0;
    }
}

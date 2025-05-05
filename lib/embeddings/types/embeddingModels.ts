export type EmbeddingProvider =
    | "openai"
    | "ollama"
    | "image"
    | "clip"
    | "none"

export type EmbeddingDataFormat = "text" | "image" | "text-and-image"

// Provider metadata
export interface ProviderInfo {
    id: EmbeddingProvider
    displayName: string
    description: string
    requiresApiKey?: boolean
    requiresEndpoint?: boolean
    isBuiltIn?: boolean
    dataFormats: EmbeddingDataFormat[]
}

// Define provider info
export const PROVIDER_INFO: Record<EmbeddingProvider, ProviderInfo> = {
    "openai": {
        id: "openai",
        displayName: "OpenAI",
        description: "Text embedding models from OpenAI's API",
        requiresApiKey: true,
        dataFormats: ["text"],
    },
    "ollama": {
        id: "ollama",
        displayName: "Ollama",
        description: "Open source text embedding models using Ollama",
        requiresEndpoint: true,
        dataFormats: ["text"],
    },
    "image": {
        id: "image",
        displayName: "TensorFlow.js",
        description: "Image embedding models that run directly in the browser",
        isBuiltIn: true,
        dataFormats: ["image"],
    },
    "clip": {
        id: "clip",
        displayName: "Transformers.js",
        description: "Multi-modal models that handle both text and images",
        isBuiltIn: true,
        dataFormats: ["text", "image", "text-and-image"],
    },
    "none": {
        id: "none",
        displayName: "None",
        description: "No embedding model (direct vector input)",
        dataFormats: ["text", "image"],
    }
}

// Define a ModelData interface to replace string model types
export interface ModelData {
    id: string // internal identifier
    name: string // display name
    provider: EmbeddingProvider
    dimensions: number
    dataFormat: EmbeddingDataFormat
    description?: string
    modelPath?: string // Optional path to the model, used for models like CLIP
    size?: string // Size of the model (for display)
    isDefault?: boolean // Whether this model is the default for its provider
    isLegacy?: boolean // Whether this model is considered legacy
    additionalInfo?: Record<string, any> // Any additional provider-specific info
}

// OpenAI Models
export const OPENAI_MODELS: ModelData[] = [
    {
        id: "text-embedding-3-small",
        name: "text-embedding-3-small",
        provider: "openai",
        dimensions: 1536,
        dataFormat: "text",
        description: "Efficient and cost-effective embedding model with good quality",
        isDefault: true,
        size: "Small"
    },
    {
        id: "text-embedding-3-large",
        name: "text-embedding-3-large",
        provider: "openai",
        dimensions: 3072,
        dataFormat: "text",
        description: "Highest quality OpenAI embedding model for advanced use cases",
        size: "Large"
    },
    {
        id: "text-embedding-ada-002",
        name: "text-embedding-ada-002",
        provider: "openai",
        dimensions: 1536,
        dataFormat: "text",
        description: "Legacy embedding model from OpenAI",
        isLegacy: true,
        size: "Medium"
    },
]

// Image Models
export const IMAGE_MODELS: ModelData[] = [
    {
        id: "mobilenet",
        name: "MobileNet V2",
        provider: "image",
        dimensions: 1024,
        dataFormat: "image",
        description: "Lightweight model optimized for mobile and web applications. Good balance of speed and accuracy.",
        isDefault: true,
        size: "Small"
    }
]

// CLIP Models
export const CLIP_MODELS: ModelData[] = [
    {
        id: "clip-vit-base-patch32",
        name: "CLIP ViT-B/32",
        provider: "clip",
        dimensions: 512,
        dataFormat: "text-and-image",
        description: "Multi-modal model that can embed both images and text in the same vector space",
        modelPath: "Xenova/clip-vit-base-patch32",
        isDefault: true,
        size: "Base"
    }
]

// Ollama Models
export const OLLAMA_MODELS: ModelData[] = [
    {
        id: "mxbai-embed-large",
        name: "MXBai Embed Large",
        provider: "ollama",
        dimensions: 1024,
        dataFormat: "text",
        description: "State-of-the-art large embedding model from mixedbread.ai",
        size: "335M",
        isDefault: true,
        additionalInfo: {
            pulls: "1.6M",
            updated: "9 months ago"
        }
    },
    {
        id: "mxbai-embed-small",
        name: "MXBai Embed Small",
        provider: "ollama",
        dimensions: 384,
        dataFormat: "text",
        description: "Smaller, faster version of MXBai embed",
        size: "33M"
    },
    {
        id: "nomic-embed-text",
        name: "Nomic Embed Text",
        provider: "ollama",
        dimensions: 768,
        dataFormat: "text",
        description: "A high-performing open embedding model with a large token context window",
        size: "17M",
        additionalInfo: {
            pulls: "3",
            updated: "12 months ago"
        }
    },
    {
        id: "all-minilm",
        name: "All-MiniLM",
        provider: "ollama",
        dimensions: 384,
        dataFormat: "text",
        description: "Embedding models trained on very large sentence level datasets",
        size: "33M",
        additionalInfo: {
            pulls: "298K",
            updated: "9 months ago"
        }
    },
    {
        id: "snowflake-arctic-embed",
        name: "Snowflake Arctic Embed",
        provider: "ollama",
        dimensions: 1024,
        dataFormat: "text",
        description: "A suite of text embedding models by Snowflake, optimized for performance",
        size: "335M",
        additionalInfo: {
            pulls: "692.8K",
            updated: "10 months ago"
        }
    },
    {
        id: "bge-m3",
        name: "BGE-M3",
        provider: "ollama",
        dimensions: 1024,
        dataFormat: "text",
        description: "BGE-M3 is a new model from BAAI distinguished for its versatility in Multi-Functionality, Multi-Linguality, and Multi-Granularity",
        size: "567M",
        additionalInfo: {
            pulls: "450.8K",
            updated: "6 months ago"
        }
    },
    {
        id: "bge-large",
        name: "BGE Large",
        provider: "ollama",
        dimensions: 1024,
        dataFormat: "text",
        description: "Embedding model from BAAI mapping texts to vectors",
        size: "335M",
        additionalInfo: {
            pulls: "82.9K",
            updated: "6 months ago"
        }
    },
    {
        id: "paraphrase-multilingual",
        name: "Paraphrase Multilingual",
        provider: "ollama",
        dimensions: 768,
        dataFormat: "text",
        description: "Sentence-transformers model that can be used for tasks like clustering or semantic search",
        size: "278M",
        additionalInfo: {
            pulls: "39.8K",
            updated: "6 months ago"
        }
    },
    {
        id: "snowflake-arctic-embed2",
        name: "Snowflake Arctic Embed 2",
        provider: "ollama",
        dimensions: 1024,
        dataFormat: "text",
        description: "Snowflake's frontier embedding model. Arctic Embed 2.0 adds multilingual support without sacrificing English performance or scalability",
        size: "568M",
        additionalInfo: {
            pulls: "31.2K",
            updated: "2 months ago"
        }
    },
    {
        id: "granite-embedding",
        name: "Granite Embedding",
        provider: "ollama",
        dimensions: 768,
        dataFormat: "text",
        description: "The IBM Granite Embedding models serve multilingual use cases",
        size: "278M"
    }
]

// Combined model registry for easy access
export const ALL_MODELS: ModelData[] = [
    ...OPENAI_MODELS,
    ...OLLAMA_MODELS,
    ...IMAGE_MODELS,
    ...CLIP_MODELS
]

// Type for OpenAI model names
export type OpenAIModelName = typeof OPENAI_MODELS[number]['id']

// Update the ImageModelName type
export type ImageModelName = typeof IMAGE_MODELS[number]['id']

// Add a new type for CLIP models
export type ClipModelName = typeof CLIP_MODELS[number]['id']

// Type for Ollama model names 
export type OllamaModelName = typeof OLLAMA_MODELS[number]['id']

// Configuration interfaces
export interface OpenAIConfig {
    model: OpenAIModelName
    batchSize?: number // For batch processing
}

export interface OllamaConfig {
    apiUrl: string
    modelName: string
    promptTemplate?: string
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
    image?: ImageConfig
    clip?: ClipConfig
    none?: NoEmbeddingConfig
}

export interface NoEmbeddingConfig {
    model: string
    dimensions: number
}

// Helper function to get all providers
export function getAllProviders(): ProviderInfo[] {
    return Object.values(PROVIDER_INFO);
}

// Helper function to get providers that support a specific data format
export function getProvidersByDataFormat(dataFormat?: EmbeddingDataFormat): ProviderInfo[] {
    if (!dataFormat) {
        return getAllProviders().filter(provider => provider.id !== "none");
    }
    
    return getAllProviders().filter(provider => 
        provider.dataFormats.includes(dataFormat) && provider.id !== "none"
    );
}

// Helper function to get all models for a specific provider
export function getModelsByProvider(provider: EmbeddingProvider): ModelData[] {
    return ALL_MODELS.filter(model => model.provider === provider);
}

// Helper function to get models by data format
export function getModelsByDataFormat(dataFormat: EmbeddingDataFormat): ModelData[] {
    return ALL_MODELS.filter(model => 
        model.dataFormat === dataFormat || 
        model.dataFormat === "text-and-image"
    );
}

// Helper function to get provider display information
export function getProviderInfo(provider: EmbeddingProvider): ProviderInfo {
    return PROVIDER_INFO[provider];
}

// Helper function to get a specific model by ID
export function getModelById(modelId: string): ModelData | undefined {
    return ALL_MODELS.find(model => model.id === modelId);
}

// Helper function to get model data for any model
export function getModelData(config: EmbeddingConfig): ModelData | undefined {
    if (!config || !("provider" in config)) {
        return undefined
    }

    if (config.provider === "openai" && config.openai?.model) {
        return getModelById(config.openai.model);
    } else if (config.provider === "image" && config.image?.model) {
        return getModelById(config.image.model);
    } else if (config.provider === "clip" && config.clip?.model) {
        return getModelById(config.clip.model);
    } else if (config.provider === "ollama" && config.ollama?.modelName) {
        // For Ollama, we try to find the model by ID, but if not found, create a basic model data
        const ollamaModel = getModelById(config.ollama.modelName);
        if (ollamaModel) {
            return ollamaModel;
        }
        
        // If not in our predefined list, create a basic model data
        return {
            id: config.ollama.modelName,
            name: config.ollama.modelName,
            provider: "ollama",
            dimensions: 1024, // Default dimension for unknown Ollama models
            dataFormat: "text",
            description: "Custom Ollama model"
        }
    } else if (config.provider === "none" && config.none?.model) {
        return {
            id: config.none.model,
            name: config.none.model,
            provider: "none",
            dimensions: config.none.dimensions,
            dataFormat: "text",
            description: "Custom vector dimensions"
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
        return "text"; // default to text if no config
    }

    // If it's a CLIP model, return text-and-image
    if (config.provider === "clip") {
        return "text-and-image";
    }

    // Check for image provider or model
    if (config.provider === "image" || config.image?.model) {
        return "image";
    }

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
    return format === "text-and-image";
}

// Helper function to get the expected dimensions for a given embedding config
export function getExpectedDimensions(config: EmbeddingConfig): number {
    const modelData = getModelData(config);
    return modelData?.dimensions || 0;
}

// Get default model for a provider
export function getDefaultModelForProvider(provider: EmbeddingProvider): ModelData | undefined {
    return getModelsByProvider(provider).find(model => model.isDefault) || 
           getModelsByProvider(provider)[0]; // Fallback to first model if no default
}

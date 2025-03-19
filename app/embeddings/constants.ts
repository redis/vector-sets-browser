
// Provider names
export const PROVIDERS = {
    OPENAI: "openai",
    OLLAMA: "ollama",
    TENSORFLOW: "tensorflow",
    IMAGE: "image",
    NONE: "none",
} as const

// Default dimensions for different models
export const DEFAULT_DIMENSIONS = {
    OPENAI: {
        "text-embedding-3-small": 1536,
        "text-embedding-3-large": 3072,
        "text-embedding-ada-002": 1536,
    },
    OLLAMA: {
        llama2: 4096,
        mistral: 4096,
    },
} as const

// Cache settings
export const CACHE = {
    KEY: "embeddingCache",
    LOG_KEY: "embeddingCache:log",
    MAX_SIZE: 10000, // Maximum number of cached embeddings
    TTL: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
} as const

// API endpoints
export const API_ENDPOINTS = {
    OPENAI: "https://api.openai.com/v1/embeddings",
    OLLAMA: "/api/ollama", // Default, can be overridden in config
} as const

// Error messages
export const ERROR_MESSAGES = {
    INVALID_PROVIDER: "Unsupported embedding provider",
    MISSING_CONFIG: "Missing configuration for provider",
    INVALID_VECTOR: "Invalid vector data",
    API_ERROR: "API error occurred",
} as const

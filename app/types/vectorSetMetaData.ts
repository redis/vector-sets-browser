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

// /**
//  * Validates and corrects metadata read from Redis
//  * Ensures it matches the expected VectorSetMetadata structure
//  * @param data The data read from Redis
//  * @returns Corrected VectorSetMetadata
//  */
// export function validateAndCorrectMetadata(data: unknown): VectorSetMetadata {
//     // Create a base metadata object with required fields
//     const correctedMetadata: VectorSetMetadata = {
//         embedding: {
//             provider: "none",
//             none: {
//                 model: "unknown",
//                 dimensions: 0,
//             },
//         },
//         created: new Date().toISOString(),
//         lastUpdated: new Date().toISOString(),
//     }

//     // If data is null or not an object, return the base metadata
//     if (!data || typeof data !== "object") {
//         return correctedMetadata
//     }

//     // Type assertion after checking it's an object
//     const typedData = data as Record<string, unknown>

//     // Check and correct embedding configuration
//     if (typedData.embedding && typeof typedData.embedding === "object") {
//         const embeddingData = typedData.embedding as Record<string, unknown>

//         // Check if provider exists and is valid
//         if (
//             "provider" in embeddingData &&
//             typeof embeddingData.provider === "string" &&
//             ["openai", "ollama", "tensorflow", "image", "none"].includes(
//                 embeddingData.provider
//             )
//         ) {
//             correctedMetadata.embedding.provider =
//                 embeddingData.provider as EmbeddingProvider

//             // Copy the provider-specific config if it exists
//             switch (embeddingData.provider) {
//                 case "openai":
//                     if (
//                         embeddingData.openai &&
//                         typeof embeddingData.openai === "object"
//                     ) {
//                         const openaiData = embeddingData.openai as Record<
//                             string,
//                             unknown
//                         >
//                         correctedMetadata.embedding.openai = {
//                             model:
//                                 typeof openaiData.model === "string"
//                                     ? openaiData.model
//                                     : "text-embedding-3-small",
//                         }
//                         if (typeof openaiData.batchSize === "number") {
//                             correctedMetadata.embedding.openai.batchSize =
//                                 openaiData.batchSize
//                         }
//                     }
//                     break
//                 case "ollama":
//                     if (
//                         embeddingData.ollama &&
//                         typeof embeddingData.ollama === "object"
//                     ) {
//                         const ollamaData = embeddingData.ollama as Record<
//                             string,
//                             unknown
//                         >
//                         correctedMetadata.embedding.ollama = {
//                             apiUrl:
//                                 typeof ollamaData.apiUrl === "string"
//                                     ? ollamaData.apiUrl
//                                     : "http://localhost:11434",
//                             modelName:
//                                 typeof ollamaData.modelName === "string"
//                                     ? ollamaData.modelName
//                                     : "all-minilm",
//                         }
//                         if (typeof ollamaData.promptTemplate === "string") {
//                             correctedMetadata.embedding.ollama.promptTemplate =
//                                 ollamaData.promptTemplate
//                         }
//                     }
//                     break
//                 case "tensorflow":
//                     if (
//                         embeddingData.tensorflow &&
//                         typeof embeddingData.tensorflow === "object"
//                     ) {
//                         const tensorflowData =
//                             embeddingData.tensorflow as Record<string, unknown>
//                         correctedMetadata.embedding.tensorflow = {
//                             model:
//                                 typeof tensorflowData.model === "string"
//                                     ? (tensorflowData.model as TensorFlowModelName)
//                                     : "universal-sentence-encoder",
//                         }
//                     }
//                     break
//                 case "image":
//                     if (
//                         embeddingData.image &&
//                         typeof embeddingData.image === "object"
//                     ) {
//                         const imageData = embeddingData.image as Record<
//                             string,
//                             unknown
//                         >
//                         correctedMetadata.embedding.image = {
//                             model:
//                                 typeof imageData.model === "string"
//                                     ? (imageData.model as ImageModelName)
//                                     : "mobilenet",
//                         }
//                         if (typeof imageData.inputSize === "number") {
//                             correctedMetadata.embedding.image.inputSize =
//                                 imageData.inputSize
//                         }
//                     }
//                     break
//                 case "none":
//                     if (
//                         embeddingData.none &&
//                         typeof embeddingData.none === "object"
//                     ) {
//                         const noneData = embeddingData.none as Record<
//                             string,
//                             unknown
//                         >
//                         correctedMetadata.embedding.none = {
//                             model:
//                                 typeof noneData.model === "string"
//                                     ? noneData.model
//                                     : "unknown",
//                             dimensions:
//                                 typeof noneData.dimensions === "number"
//                                     ? noneData.dimensions
//                                     : 0,
//                         }
//                     }
//                     break
//             }
//         }
//     }

//     // Copy other metadata fields if they exist
//     if (typeof typedData.created === "string") {
//         correctedMetadata.created = typedData.created
//     }

//     if (typeof typedData.lastUpdated === "string") {
//         correctedMetadata.lastUpdated = typedData.lastUpdated
//     } else {
//         correctedMetadata.lastUpdated = correctedMetadata.created
//     }

//     if (typeof typedData.description === "string") {
//         correctedMetadata.description = typedData.description
//     }

//     if (typeof typedData.totalVectors === "number") {
//         correctedMetadata.totalVectors = typedData.totalVectors
//     }

//     // Get dimensions from model data or use provided dimensions
//     const modelData = getModelData(correctedMetadata.embedding)
//     correctedMetadata.dimensions =
//         modelData?.dimensions ||
//         (typeof typedData.dimensions === "number" ? typedData.dimensions : 0)

//     // Copy Redis config if it exists
//     if (typedData.redisConfig && typeof typedData.redisConfig === "object") {
//         const redisConfigData = typedData.redisConfig as Record<string, unknown>
//         correctedMetadata.redisConfig = {}

//         if (typeof redisConfigData.reduceDimensions === "number") {
//             correctedMetadata.redisConfig.reduceDimensions =
//                 redisConfigData.reduceDimensions
//         }

//         if (typeof redisConfigData.defaultCAS === "boolean") {
//             correctedMetadata.redisConfig.defaultCAS =
//                 redisConfigData.defaultCAS
//         }

//         if (
//             typeof redisConfigData.quantization === "string" &&
//             ["Q8", "BIN", "NOQUANT"].includes(redisConfigData.quantization)
//         ) {
//             correctedMetadata.redisConfig.quantization =
//                 redisConfigData.quantization as "Q8" | "BIN" | "NOQUANT"
//         }

//         if (typeof redisConfigData.buildExplorationFactor === "number") {
//             correctedMetadata.redisConfig.buildExplorationFactor =
//                 redisConfigData.buildExplorationFactor
//         }
//     }

//     return correctedMetadata
// }

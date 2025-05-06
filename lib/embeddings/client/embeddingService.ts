import { EmbeddingConfig, CLIP_MODELS } from "@/lib/embeddings/types/embeddingModels"
import { preprocessImage } from "./imageProcessingService"

// Cache for models to avoid reloading
const modelCache: Record<string, any> = {}
let mobilenetModule: any = null
let isModelLoading = false

// Embedding cache to avoid regenerating the same embeddings
interface EmbeddingCacheEntry {
    embedding: number[];
    timestamp: number;
}
const embeddingCache: Map<string, EmbeddingCacheEntry> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Calculate a cache key based on input data and config
const getCacheKey = (inputData: string, config: EmbeddingConfig, isImage: boolean = false): string => {
    const configStr = JSON.stringify(config);
    // Use just first 50 chars + length of data for the cache key to avoid 
    // memory issues with very large data strings
    const dataKey = `${inputData.substring(0, 50)}_${inputData.length}_${isImage ? 'image' : 'text'}`;
    return `${dataKey}_${configStr}`;
};

/**
 * Client-side embedding service that handles caching and generation of embeddings
 */
export class ClientEmbeddingService {
    /**
     * Generate an embedding from text or image data
     */
    async getEmbedding(
        inputData: string,
        config: EmbeddingConfig,
        isImage: boolean = false
    ): Promise<number[]> {
        if (!inputData) {
            throw new Error("No input data provided")
        }

        // Check cache first
        const cacheKey = getCacheKey(inputData, config, isImage);
        const now = Date.now();
        const cached = embeddingCache.get(cacheKey);
        
        if (cached && now - cached.timestamp < CACHE_TTL) {
            console.log("Using cached embedding");
            return cached.embedding;
        }

        let embedding: number[];

        if (isImage) {
            // Handle image embedding
            if (config.provider === "clip") {
                embedding = await this.generateClipEmbedding(inputData, config)
            } else if (config.provider === "image") {
                embedding = await this.generateTensorFlowEmbedding(inputData)
            } else {
                throw new Error(`Unsupported provider for image embedding: ${config.provider}`)
            }
        } else {
            // Handle text embedding (via API)
            embedding = await this.generateTextEmbedding(inputData, config)
        }

        // Cache the result
        embeddingCache.set(cacheKey, { embedding, timestamp: now });
        
        // Cleanup old cache entries if cache gets too large
        if (embeddingCache.size > 100) {
            const oldEntries = [...embeddingCache.entries()]
                .filter(([_, entry]) => now - entry.timestamp > CACHE_TTL)
                .slice(0, 20); // Remove oldest 20 entries that are expired
                
            for (const [key] of oldEntries) {
                embeddingCache.delete(key);
            }
        }
        
        return embedding;
    }

    /**
     * Generate embedding using CLIP model
     */
    private async generateClipEmbedding(
        imageData: string,
        config: EmbeddingConfig
    ): Promise<number[]> {
        try {
            console.log("Generating embedding using CLIP...")
            const { CLIPProvider } = await import("@/lib/embeddings/providers/clip")
            const clipProvider = new CLIPProvider()

            const modelPath = config.clip?.model
                ? CLIP_MODELS.find(model => model.id === config.clip?.model)?.modelPath
                : "Xenova/clip-vit-base-patch32"

            return await clipProvider.getImageEmbedding(
                imageData as string,
                modelPath as string
            )
        } catch (error) {
            console.error("Error generating CLIP embedding:", error)
            throw error
        }
    }

    /**
     * Generate embedding using TensorFlow.js (MobileNet)
     */
    private async generateTensorFlowEmbedding(
        imageData: string
    ): Promise<number[]> {
        try {
            const model = await this.loadImageModel()

            // Preprocess the image
            const tensor = await preprocessImage(imageData)

            console.log("Generating embedding using TensorFlow MobileNet...")
            // Get the internal model to access the penultimate layer
            // @ts-ignore - accessing internal property
            const internalModel = model.model

            // Execute the model up to the penultimate layer
            // This gives us the feature vector (embedding) before classification
            let activationLayer

            try {
                // MobileNet v1 has a layer usually called 'global_average_pooling2d'
                activationLayer = internalModel.execute(tensor, [
                    "global_average_pooling2d",
                ])
            } catch (_e) {
                console.log(
                    "Couldn't find global_average_pooling2d layer, using default model output"
                )
                // If we can't get the specific layer, just use the model directly
                activationLayer = model.infer(tensor, true)
            }

            // Convert to array and check values
            const embedding = Array.from(await activationLayer.data()) as number[]

            // Clean up the tensors
            tensor.dispose()
            activationLayer.dispose()

            return embedding
        } catch (error) {
            console.error("Error generating TensorFlow embedding:", error)
            throw error
        }
    }

    /**
     * Generate text embedding via API
     */
    private async generateTextEmbedding(
        text: string,
        config: EmbeddingConfig
    ): Promise<number[]> {
        try {
            const baseUrl =
                process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
            const response = await fetch(`${baseUrl}/api/embeddings`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text,
                    config,
                }),
            })

            if (!response.ok) {
                throw new Error(`Failed to get embedding: ${response.statusText}`)
            }

            const data = await response.json()
            if (!data.success) {
                throw new Error(`Failed to get embedding: ${data.error}`)
            }

            return data.result
        } catch (error) {
            console.error("Error generating text embedding:", error)
            throw error
        }
    }

    /**
     * Load a TensorFlow.js image model (MobileNet)
     */
    private async loadImageModel(): Promise<any> {
        const modelName = "mobilenet"

        // Return cached model if available
        if (modelCache[modelName]) {
            return modelCache[modelName]
        }

        // Wait if model is already loading
        if (isModelLoading) {
            while (isModelLoading) {
                await new Promise((resolve) => setTimeout(resolve, 100))
            }
            if (modelCache[modelName]) {
                return modelCache[modelName]
            }
        }

        try {
            isModelLoading = true
            console.log(`Loading image model: ${modelName}`)

            // Ensure TensorFlow.js is loaded via ImageProcessingService
            await preprocessImage("data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==")

            // Lazy load MobileNet
            if (!mobilenetModule) {
                console.log("Dynamically importing MobileNet")
                mobilenetModule = await import("@tensorflow-models/mobilenet")
            }

            // For now, we only support MobileNet
            // Use version 1 with alpha 1.0 for best compatibility
            const model = await mobilenetModule.load({
                version: 1,
                alpha: 1.0,
            })

            // Cache the model
            modelCache[modelName] = model

            console.log(`Image model loaded: ${modelName}`)
            return model
        } catch (error) {
            console.error(`Error loading image model: ${modelName}`, error)
            throw error
        } finally {
            isModelLoading = false
        }
    }
}

// Create a singleton instance
export const clientEmbeddingService = new ClientEmbeddingService() 
import { preprocessImage } from './ImageProcessingService'
import { EmbeddingConfig, CLIP_MODELS } from "@/lib/embeddings/types/embeddingModels"

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

// Calculate a cache key based on image data and config
const getCacheKey = (imageData: string, config: EmbeddingConfig): string => {
    const configStr = JSON.stringify(config);
    // Use just first 50 chars + length of image data for the cache key to avoid 
    // memory issues with very large image data strings
    const dataKey = `${imageData.substring(0, 50)}_${imageData.length}`;
    return `${dataKey}_${configStr}`;
};

/**
 * Generate an embedding from image data using either TensorFlow or CLIP
 */
export const generateImageEmbedding = async (
    imageData: string,
    config: EmbeddingConfig
): Promise<number[]> => {
    if (!imageData) {
        throw new Error("No image data provided")
    }

    // Check cache first
    const cacheKey = getCacheKey(imageData, config);
    const now = Date.now();
    const cached = embeddingCache.get(cacheKey);
    
    if (cached && now - cached.timestamp < CACHE_TTL) {
        console.log("Using cached embedding");
        return cached.embedding;
    }

    // Generate new embedding
    let embedding: number[];

    // Check if we're using CLIP
    if (config.provider === "clip") {
        embedding = await generateClipEmbedding(imageData, config)
    } else if (config.provider === "image") {
        embedding = await generateTensorFlowEmbedding(imageData)
    } else {
        throw new Error(`Unsupported provider for image embedding: ${config.provider}`)
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
const generateClipEmbedding = async (
    imageData: string,
    config: EmbeddingConfig
): Promise<number[]> => {
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
const generateTensorFlowEmbedding = async (
    imageData: string
): Promise<number[]> => {
    try {
        const model = await loadImageModel()

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
 * Load a TensorFlow.js image model (MobileNet)
 */
async function loadImageModel(): Promise<any> {
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
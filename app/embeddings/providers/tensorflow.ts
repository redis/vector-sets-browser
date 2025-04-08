import { EmbeddingConfig, getModelData } from "../types/embeddingModels"
import { EmbeddingProvider } from "./base"

// Text-related TensorFlow functionality is commented out
// Keeping the structure for image processing only

// Define a type for the TensorFlow model
// type UniversalSentenceEncoderModel = {
//     embed: (inputs: string[]) => Promise<any>
// }

// Map to store loaded models to avoid reloading
const modelCache = new Map<string, any>()

export class TensorFlowProvider implements EmbeddingProvider {
    async getEmbedding(input: string, config: EmbeddingConfig): Promise<number[]> {
        if (!config.tensorflow) {
            throw new Error("TensorFlow.js configuration is missing")
        }

        throw new Error("Text embeddings are currently disabled. Please use image embeddings only.")
    }

    async getBatchEmbeddings(inputs: string[], config: EmbeddingConfig): Promise<number[][]> {
        if (!config.tensorflow) {
            throw new Error("TensorFlow.js configuration is missing")
        }

        throw new Error("Text embeddings are currently disabled. Please use image embeddings only.")
    }

    private async loadModel(modelUrl: string): Promise<any> {
        // Check if model is already loaded
        if (modelCache.has(modelUrl)) {
            return modelCache.get(modelUrl)!
        }

        try {
            const tf = await import('@tensorflow/tfjs')
            const mobilenet = await import('@tensorflow-models/mobilenet')
            
            // Load the mobilenet model
            console.log(`[TensorFlow] Loading model from ${modelUrl}`)
            const model = await mobilenet.load()
            
            // Cache the model
            modelCache.set(modelUrl, model)
            
            return model
        } catch (error) {
            console.error(`[TensorFlow] Error loading model from ${modelUrl}:`, error)
            throw new Error(`Failed to load TensorFlow model: ${error instanceof Error ? error.message : String(error)}`)
        }
    }
} 
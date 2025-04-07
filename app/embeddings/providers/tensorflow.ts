import { EmbeddingConfig, getModelData } from "../types/embeddingModels"
import { EmbeddingProvider } from "./base"

// Define a type for the TensorFlow model
type UniversalSentenceEncoderModel = {
    embed: (inputs: string[]) => Promise<any>
}

// Map to store loaded models to avoid reloading
const modelCache = new Map<string, UniversalSentenceEncoderModel>()

export class TensorFlowProvider implements EmbeddingProvider {
    async getEmbedding(input: string, config: EmbeddingConfig): Promise<number[]> {
        if (!config.tensorflow) {
            throw new Error("TensorFlow.js configuration is missing")
        }

        try {
            // Load the model
            const model = await this.loadModel(config.tensorflow.model)

            // Get embeddings
            const embeddings = await model.embed([input])

            // Convert to array
            const embeddingsArray = await embeddings.arraySync()
            const embedding = embeddingsArray[0]

            // Validate embedding dimensions
            const modelData = getModelData(config)
            const expectedDim = modelData?.dimensions
            if (expectedDim && embedding.length !== expectedDim) {
                throw new Error(
                    `Unexpected embedding dimension: got ${embedding.length}, expected ${expectedDim}`
                )
            }

            return embedding
        } catch (error) {
            console.error("[TensorFlow] Error generating embedding:", error)
            throw error
        }
    }

    async getBatchEmbeddings(inputs: string[], config: EmbeddingConfig): Promise<number[][]> {
        if (!config.tensorflow) {
            throw new Error("TensorFlow.js configuration is missing")
        }

        try {
            // Load the model
            const model = await this.loadModel(config.tensorflow.model)

            // Get embeddings for all inputs at once
            const embeddings = await model.embed(inputs)

            // Convert to array
            const embeddingsArray = await embeddings.arraySync()

            // Validate embedding dimensions
            const modelData = getModelData(config)
            const expectedDim = modelData?.dimensions
            if (expectedDim) {
                for (let i = 0; i < embeddingsArray.length; i++) {
                    const embedding = embeddingsArray[i]
                    if (embedding.length !== expectedDim) {
                        throw new Error(
                            `Unexpected embedding dimension for item ${i}: got ${embedding.length}, expected ${expectedDim}`
                        )
                    }
                }
            }

            return embeddingsArray
        } catch (error) {
            console.error("[TensorFlow] Error generating batch embeddings:", error)
            throw error
        }
    }

    private async loadModel(modelUrl: string): Promise<UniversalSentenceEncoderModel> {
        // Check if model is already loaded
        if (modelCache.has(modelUrl)) {
            return modelCache.get(modelUrl)!
        }

        try {
            // Dynamically import TensorFlow.js and Universal Sentence Encoder
            // const tf = await import('@tensorflow/tfjs')
            const use = await import('@tensorflow-models/universal-sentence-encoder')

            // Load the model
            console.log(`[TensorFlow] Loading model from ${modelUrl}`)
            const model = await use.load()

            // Cache the model
            modelCache.set(modelUrl, model)

            return model
        } catch (error) {
            console.error(`[TensorFlow] Error loading model from ${modelUrl}:`, error)
            throw new Error(`Failed to load TensorFlow model: ${error instanceof Error ? error.message : String(error)}`)
        }
    }
} 
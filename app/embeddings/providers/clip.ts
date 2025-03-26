import { EmbeddingConfig, getModelData } from "../types/embeddingModels"
import { EmbeddingProvider } from "./base"

// Cache for loaded models
const modelCache = new Map<string, any>()

export class CLIPProvider implements EmbeddingProvider {
    private pipeline: any = null
    
    async getEmbedding(input: string, config: EmbeddingConfig): Promise<number[]> {
        if (!config.image) {
            throw new Error("CLIP configuration is missing")
        }

        try {
            // Initialize the pipeline if not already done
            if (!this.pipeline) {
                const { pipeline } = await import('@xenova/transformers')
                this.pipeline = await pipeline('feature-extraction', config.image.modelPath || 'Xenova/clip-vit-base-patch32')
            }

            // Determine if input is base64 image data or text
            const isBase64Image = input.startsWith('data:image')
            
            let embedding: number[]
            if (isBase64Image) {
                // Process image input
                const imageData = await this.preprocessImage(input)
                const result = await this.pipeline(imageData, { pooling: 'mean', normalize: true })
                embedding = Array.from(result.data)
            } else {
                // Process text input
                const result = await this.pipeline(input, { pooling: 'mean', normalize: true })
                embedding = Array.from(result.data)
            }

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
            console.error("[CLIP] Error generating embedding:", error)
            throw error
        }
    }

    private async preprocessImage(base64Data: string): Promise<any> {
        // Convert base64 to blob
        const response = await fetch(base64Data)
        const blob = await response.blob()
        return blob
    }

    // Batch processing is not yet supported for CLIP
    async getBatchEmbeddings(inputs: string[], config: EmbeddingConfig): Promise<number[][]> {
        const embeddings: number[][] = []
        for (const input of inputs) {
            const embedding = await this.getEmbedding(input, config)
            embeddings.push(embedding)
        }
        return embeddings
    }
} 
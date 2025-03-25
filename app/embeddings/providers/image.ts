import { EmbeddingConfig, getModelData } from "../types/embeddingModels"
import { EmbeddingProvider } from "./base"
import { getImageEmbedding } from "@/app/utils/imageEmbedding"

export class ImageProvider implements EmbeddingProvider {
    async getEmbedding(input: string, config: EmbeddingConfig): Promise<number[]> {
        if (!config.image) {
            throw new Error("Image configuration is missing")
        }

        try {
            // Get the embedding using our image embedding utility
            const embedding = await getImageEmbedding(input, config.image)
            
            // Validate embedding dimensions
            const modelData = getModelData(config)
            const expectedDim = modelData?.dimensions
            if (expectedDim && embedding.length !== expectedDim) {
                throw new Error(
                    `Unexpected image embedding dimension: got ${embedding.length}, expected ${expectedDim}`
                )
            }
            
            return embedding
        } catch (error) {
            console.error("[Image] Error generating embedding:", error)

            // Provide a clear error message for server-side image processing
            if (
                error instanceof Error &&
                (error.message.includes("Image is not defined") ||
                    error.message.includes(
                        "Image processing in server components is not supported"
                    ))
            ) {
                throw new Error(
                    "Image processing cannot be performed in server components. " +
                    "Please use a client component for image processing."
                )
            }

            throw error
        }
    }

    // Image provider doesn't support batch embeddings directly
    // Each image would need to be processed individually
    async getBatchEmbeddings(inputs: string[], config: EmbeddingConfig): Promise<number[][]> {
        const embeddings: number[][] = []
        for (const input of inputs) {
            const embedding = await this.getEmbedding(input, config)
            embeddings.push(embedding)
        }
        return embeddings
    }
} 
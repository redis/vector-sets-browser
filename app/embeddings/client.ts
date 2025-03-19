import { apiClient } from "@/app/api/client"
import { EmbeddingConfig } from "@/app/embeddings/types/config"
import { EmbeddingRequestBody } from "@/app/embeddings/types/response"

export interface ApiResponse<T = unknown> {
    success: boolean
    result?: T
    error?: string
    executionTimeMs?: number
    executedCommand?: string
}

export const embeddings = {
    async getEmbedding(
        config: EmbeddingConfig,
        text?: string,
        imageData?: string
    ): Promise<ApiResponse<number[]>> {
        try {
            const response = await apiClient.post<ApiResponse<number[]>, EmbeddingRequestBody>(
                "/api/embeddings",
                {
                    text,
                    imageData,
                    config,
                }
            );
            
            // Manually construct the ApiResponse object
            console.log("[getEmbedding] Response:", response)
            return {
                success: true,
                result: response.result,
                executionTimeMs: response.executionTimeMs || undefined
            };
        } catch (error) {
            if (error instanceof Error) {
                return {
                    success: false,
                    error: error.message
                };
            }
            return {
                success: false,
                error: 'Unknown error'
            };
        }
    },

    async getBatchEmbeddings(
        config: EmbeddingConfig,
        texts: string[]
    ): Promise<ApiResponse<number[][]>> {
        return apiClient.post<
            ApiResponse<number[][]>,
            { texts: string[]; config: EmbeddingConfig }
        >("/api/embeddings/batch", {
            texts,
            config,
        })
    },
}

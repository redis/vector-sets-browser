import { apiClient, ApiResponse } from "@/app/api/client"
import { EmbeddingConfig } from "@/app/embeddings/types/embeddingModels"
import { EmbeddingRequestBody } from "@/app/embeddings/types/response"
import { userSettings } from "@/app/utils/userSettings"

export const embeddings = {
    async getEmbedding(
        config: EmbeddingConfig,
        text?: string,
        imageData?: string
    ): Promise<ApiResponse<number[]>> {
        try {
            // Get user-provided API key if available
            const userApiKey = userSettings.get<string>("openai_api_key");
            
            // Prepare headers
            const headers: Record<string, string> = {};
            if (userApiKey) {
                headers["X-OpenAI-Key"] = userApiKey;
            }

            const response = await apiClient.post<ApiResponse<number[]>, EmbeddingRequestBody>(
                "/api/embeddings",
                {
                    text,
                    imageData,
                    config,
                },
                headers
            );

            // Manually construct the ApiResponse object
            console.log("[getEmbedding] Response:", response)
            return {
                success: true,
                result: response.result as any,
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
        try {
            // Get user-provided API key if available
            const userApiKey = userSettings.get<string>("openai_api_key");
            
            // Prepare headers
            const headers: Record<string, string> = {};
            if (userApiKey) {
                headers["X-OpenAI-Key"] = userApiKey;
            }

            const response = await apiClient.post<ApiResponse<number[][]>, { texts: string[]; config: EmbeddingConfig }>(
                "/api/embeddings/batch",
                {
                    texts,
                    config,
                },
                headers
            );

            // Manually construct the ApiResponse object
            return {
                success: true,
                result: response.result as any,
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
}

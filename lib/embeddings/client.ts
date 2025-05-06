import { apiClient, ApiResponse } from "@/app/api/client"
import { EmbeddingConfig } from "@/lib/embeddings/types/embeddingModels"
import { EmbeddingRequestBody } from "@/lib/embeddings/types/response"
import { userSettings } from "@/lib/storage/userSettings"
import { clientEmbeddingService } from "./client/embeddingService"

export const embeddings = {
    async getEmbedding(
        config: EmbeddingConfig,
        text?: string,
        imageData?: string
    ): Promise<ApiResponse<number[]>> {
        try {
            if (!text && !imageData) {
                return {
                    success: false,
                    error: "Either text or imageData must be provided"
                };
            }

            // Use client-side embedding service
            const isImage = !!imageData;
            const inputData = isImage ? imageData as string : text as string;
            
            const embedding = await clientEmbeddingService.getEmbedding(
                inputData,
                config,
                isImage
            );

            return {
                success: true,
                result: embedding
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

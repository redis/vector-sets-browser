import { z } from "zod"

export const EmbeddingTemplateResponseObject = z.object({
    elementTemplate: z.string(),
    embeddingTemplate: z.string(),
})

export type EmbeddingTemplateResponse = z.infer<typeof EmbeddingTemplateResponseObject>

// Type definitions for the request body
export interface EmbeddingTemplateRequestBody {
    columns: string[]
    sampleRows: string[]
}

export const generateEmbeddingTemplate = async (columns: string[], sampleRows: string[]): Promise<EmbeddingTemplateResponse> => {
    // Get user-provided API key if available
    const userApiKey = typeof window !== 'undefined' ? localStorage.getItem("openai_api_key") : null;
    
    const response = await fetch("/api/openai/generatetemplate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(userApiKey ? { "X-OpenAI-Key": userApiKey } : {})
        },
        body: JSON.stringify({ columns, sampleRows }),
    })
    return await response.json()
}

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
    const response = await fetch("/api/openai/generatetemplate", {
        method: "POST",
        body: JSON.stringify({ columns, sampleRows }),
    })
    return await response.json()
}

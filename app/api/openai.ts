import { userSettings } from "@/app/utils/userSettings";
import { z } from "zod";

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

export interface FilterQueryRequestBody {
    query: string
    attributes?: string[]
}

export interface FilterQueryResponse {
    filterQuery: string
}

export async function getOpenAIKey(): Promise<string | null> {
    try {
        return userSettings.get<string>("openai_api_key");
    } catch (error) {
        console.error("Error getting OpenAI API key:", error);
        return null;
    }
}

export const generateEmbeddingTemplate = async (columns: string[], sampleRows: string[]): Promise<EmbeddingTemplateResponse> => {
    // Get user-provided API key if available
    const userApiKey = await getOpenAIKey();
    
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

export const generateFilterQuery = async (query: string, attributes?: string[]): Promise<FilterQueryResponse> => {
    // Get user-provided API key if available
    const userApiKey = await getOpenAIKey();
    
    const response = await fetch("/api/openai/generatefilterquery", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(userApiKey ? { "X-OpenAI-Key": userApiKey } : {})
        },
        body: JSON.stringify({ query, attributes }),
    })

    const result = await response.json();
    
    if (result.error) {
        throw new Error(result.error);
    }
    
    return result;
}

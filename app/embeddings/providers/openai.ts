import { EmbeddingConfig, getModelData } from "../types/embeddingModels"
import { EmbeddingProvider } from "./base"
import { getOpenAIKey } from "@/app/api/openai/helpers"

export class OpenAIProvider implements EmbeddingProvider {
    async getEmbedding(input: string, config: EmbeddingConfig): Promise<number[]> {
        if (!config.openai) {
            throw new Error("OpenAI configuration is missing")
        }

        const apiKey = await getOpenAIKey()
        if (!apiKey) {
            throw new Error("OpenAI API key is missing. Please configure it in your user settings.")
        }

        const response = await fetch("https://api.openai.com/v1/embeddings", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
                "OpenAI-Organization": process.env.OPENAI_ORG_ID || "",
            },
            body: JSON.stringify({
                input: input,
                model: config.openai.model,
                encoding_format: "float",
            }),
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
        }

        const data = await response.json()
        const embedding = data.data[0].embedding

        // Validate embedding dimensions
        const modelData = getModelData(config)
        const expectedDim = modelData?.dimensions
        if (expectedDim && embedding.length !== expectedDim) {
            throw new Error(
                `Unexpected embedding dimension: got ${embedding.length}, expected ${expectedDim}`
            )
        }

        return embedding
    }

    async getBatchEmbeddings(inputs: string[], config: EmbeddingConfig): Promise<number[][]> {
        if (!config.openai) {
            throw new Error("OpenAI configuration is missing")
        }

        const apiKey = await getOpenAIKey()
        if (!apiKey) {
            throw new Error("OpenAI API key is missing. Please configure it in your user settings.")
        }

        const batchSize = config.openai.batchSize || 20
        const batches = []

        // Split inputs into batches
        for (let i = 0; i < inputs.length; i += batchSize) {
            batches.push(inputs.slice(i, i + batchSize))
        }

        // Process each batch
        const embeddings = []
        for (const batch of batches) {
            const response = await fetch("https://api.openai.com/v1/embeddings", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                    "OpenAI-Organization": process.env.OPENAI_ORG_ID || "",
                },
                body: JSON.stringify({
                    input: batch,
                    model: config.openai.model,
                    encoding_format: "float",
                }),
            })

            if (!response.ok) {
                const errorText = await response.text()
                throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
            }

            const data = await response.json()
            const batchEmbeddings = data.data.map((item: any) => item.embedding)

            // Validate embedding dimensions
            const modelData = getModelData(config)
            const expectedDim = modelData?.dimensions
            if (expectedDim) {
                for (let i = 0; i < batchEmbeddings.length; i++) {
                    const embedding = batchEmbeddings[i]
                    if (embedding.length !== expectedDim) {
                        throw new Error(
                            `Unexpected embedding dimension for item ${i}: got ${embedding.length}, expected ${expectedDim}`
                        )
                    }
                }
            }

            embeddings.push(...batchEmbeddings)
        }

        return embeddings
    }
} 
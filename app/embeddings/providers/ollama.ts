import { EmbeddingConfig, getModelData } from "../types/embeddingModels"
import { EmbeddingProvider } from "./base"

export class OllamaProvider implements EmbeddingProvider {
    async getEmbedding(input: string, config: EmbeddingConfig): Promise<number[]> {
        if (!config.ollama) {
            throw new Error("Ollama configuration is missing")
        }

        const prompt = config.ollama.promptTemplate?.replace("{text}", input) || input

        const response = await fetch(`${config.ollama.apiUrl}/api/embed`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: config.ollama.modelName,
                input: prompt,
            }),
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Ollama API error: ${response.status} - ${errorText}`)
        }

        const data = await response.json()
        const embedding = data.embeddings[0]

        // Validate embedding dimensions
        const modelData = getModelData(config)
        const expectedDim = modelData?.dimensions
        if (expectedDim && embedding && embedding.length !== expectedDim) {
            throw new Error(
                `Unexpected embedding dimension: got ${embedding.length}, expected ${expectedDim}`
            )
        }
        
        return embedding
    }

    async getBatchEmbeddings(inputs: string[], config: EmbeddingConfig): Promise<number[][]> {
        // Process sequentially for now - Ollama doesn't have a batch API
        const embeddings = []
        for (const input of inputs) {
            const embedding = await this.getEmbedding(input, config)
            embeddings.push(embedding)
        }
        return embeddings
    }
} 
import { EmbeddingConfig } from "../types/embeddingModels"

export interface EmbeddingProvider {
    getEmbedding(input: string, config: EmbeddingConfig): Promise<number[]>
    getBatchEmbeddings?(inputs: string[], config: EmbeddingConfig): Promise<number[][]>
} 
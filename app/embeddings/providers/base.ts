import { EmbeddingConfig } from "../types/config"

export interface EmbeddingProvider {
    getEmbedding(input: string, config: EmbeddingConfig): Promise<number[]>
    getBatchEmbeddings?(inputs: string[], config: EmbeddingConfig): Promise<number[][]>
} 
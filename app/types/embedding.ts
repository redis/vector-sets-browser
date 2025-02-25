export type EmbeddingProvider = 'openai' | 'ollama' | 'none';

export type OpenAIModel = 'text-embedding-3-small' | 'text-embedding-3-large' | 'text-embedding-ada-002';

export interface OpenAIConfig {
  apiKey: string;
  model: OpenAIModel;
  dimensions?: number; // Optional - will be determined by model if not specified
  batchSize?: number; // For batch processing
  cacheTTL?: number; // Time to live for cached embeddings in seconds
}

export interface OllamaConfig {
  apiUrl: string;
  modelName: string;
  promptTemplate?: string;
}

export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  openai?: OpenAIConfig;
  ollama?: OllamaConfig;
}

export interface VectorSetMetadata {
  embedding: EmbeddingConfig;
  created: string;
  description?: string;
  lastUpdated?: string;
  totalVectors?: number;
  dimensions?: number;
}

export const MODEL_DIMENSIONS = {
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
  'text-embedding-ada-002': 1536
} as const;

export function createVectorSetMetadata(config: EmbeddingConfig, description?: string): VectorSetMetadata {
  let dimensions: number | undefined;
  
  if (config.provider === 'openai' && config.openai?.model) {
    dimensions = MODEL_DIMENSIONS[config.openai.model];
  }

  return {
    embedding: config,
    created: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    description,
    dimensions
  };
} 
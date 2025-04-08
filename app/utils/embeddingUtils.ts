import { EmbeddingConfig, EmbeddingProvider } from "@/app/embeddings/types/embeddingModels";

/**
 * Checks if Ollama is available on the default port
 * @returns Promise<boolean> - true if Ollama is available
 */
export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const response = await fetch("http://localhost:11434/api/tags", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    
    return response.ok;
  } catch (error) {
    console.log("Ollama not available:", error);
    return false;
  }
}

/**
 * Gets the best available text embedding configuration
 * Prioritizes: 1. CLIP 2. Ollama (if available) 3. OpenAI
 * @returns Promise<EmbeddingConfig> - the best available embedding config
 */
export async function getDefaultTextEmbeddingConfig(): Promise<EmbeddingConfig> {
  // Try to use CLIP first
  try {
    const { pipeline } = await import('@xenova/transformers')
    // Just check if we can initialize the pipeline
    await pipeline('feature-extraction', 'Xenova/clip-vit-base-patch32')
    return {
      provider: "clip",
      clip: {
        model: "clip-vit-base-patch32"
      }
    }
  } catch (e) {
    console.log("CLIP not available, falling back to other providers")
  }
  
  const ollamaAvailable = await isOllamaAvailable();
  
  if (ollamaAvailable) {
    return {
      provider: "ollama",
      ollama: {
        apiUrl: "http://localhost:11434",
        modelName: "mxbai-embed-large",
      },
    };
  }
  
  // Fall back to OpenAI
  return {
    provider: "openai",
    openai: {
      model: "text-embedding-3-small",
      batchSize: 100,
    },
  };
}

/**
 * Gets the default image embedding configuration
 * Prioritizes: 1. CLIP 2. OpenAI
 * @returns EmbeddingConfig - the default image embedding config
 */
export function getDefaultImageEmbeddingConfig(): EmbeddingConfig {
  // Try to use CLIP first
  try {
    return {
      provider: "clip",
      clip: {
        model: "clip-vit-base-patch32"
      }
    }
  } catch (e) {
    console.log("CLIP not available, falling back to OpenAI")
    // Fall back to OpenAI
    return {
      provider: "openai",
      openai: {
        model: "text-embedding-3-small",
        batchSize: 100,
      },
    }
  }
}

/**
 * Gets the best available embedding configuration based on data type
 * @param dataType - The type of data ("text" or "image")
 * @returns Promise<EmbeddingConfig> - the best available embedding config for the data type
 */
export async function getDefaultEmbeddingConfig(dataType: "text" | "image"): Promise<EmbeddingConfig> {
  if (dataType === "text") {
    return getDefaultTextEmbeddingConfig();
  } else {
    return getDefaultImageEmbeddingConfig();
  }
} 
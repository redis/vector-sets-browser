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
 * Prioritizes: 1. Ollama (if available) 2. TensorFlow
 * @returns Promise<EmbeddingConfig> - the best available embedding config
 */
export async function getDefaultTextEmbeddingConfig(): Promise<EmbeddingConfig> {
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
  
  // Fall back to TensorFlow
  return {
    provider: "tensorflow",
    tensorflow: {
      model: "universal-sentence-encoder",
    },
  };
}

/**
 * Gets the default image embedding configuration
 * @returns EmbeddingConfig - the default image embedding config
 */
export function getDefaultImageEmbeddingConfig(): EmbeddingConfig {
  return {
    provider: "image",
    image: {
      model: "mobilenet",
    },
  };
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
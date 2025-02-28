// Remove static imports
// import * as tf from '@tensorflow/tfjs';
// import * as use from '@tensorflow-models/universal-sentence-encoder';
import { TensorFlowConfig } from '@/app/types/embedding';

// Module references for lazy loading
let tf: any = null;
let use: any = null;
let tfInitialized = false;

// Cache for models to avoid reloading
const modelCache: Record<string, any> = {};
let isModelLoading = false;

/**
 * Load a TensorFlow.js model
 */
export async function loadModel(config: TensorFlowConfig): Promise<any> {
  const modelName = config.model;
  
  // Return cached model if available
  if (modelCache[modelName]) {
    return modelCache[modelName];
  }
  
  // Wait if model is already loading
  if (isModelLoading) {
    while (isModelLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (modelCache[modelName]) {
      return modelCache[modelName];
    }
  }
  
  try {
    isModelLoading = true;
    console.log(`[TensorFlow.js] Loading model: ${modelName}`);
    
    // Lazy load TensorFlow.js and Universal Sentence Encoder
    if (!tf) {
      console.log('[TensorFlow.js] Dynamically importing TensorFlow.js');
      tf = await import('@tensorflow/tfjs');
    }
    
    if (!use) {
      console.log('[TensorFlow.js] Dynamically importing Universal Sentence Encoder');
      use = await import('@tensorflow-models/universal-sentence-encoder');
    }
    
    // Initialize TensorFlow.js
    if (!tfInitialized) {
      console.log('[TensorFlow.js] Initializing TensorFlow.js');
      await tf.ready();
      tfInitialized = true;
    }
    
    // Load the Universal Sentence Encoder model
    // Note: In a more complex implementation, we would load different models based on the config
    const model = await use.load();
    
    // Cache the model
    modelCache[modelName] = model;
    
    console.log(`[TensorFlow.js] Model loaded: ${modelName}`);
    return model;
  } catch (error) {
    console.error(`[TensorFlow.js] Error loading model: ${modelName}`, error);
    throw error;
  } finally {
    isModelLoading = false;
  }
}

/**
 * Get embeddings for text using TensorFlow.js
 */
export async function getEmbedding(text: string, config: TensorFlowConfig): Promise<number[]> {
  try {
    // Load the model
    const model = await loadModel(config);
    
    // Get embeddings
    const embeddings = await model.embed([text]);
    
    // Convert to array
    const embedding = Array.from(await embeddings.array())[0];
    
    return embedding;
  } catch (error) {
    console.error('[TensorFlow.js] Error generating embedding:', error);
    throw error;
  }
}

/**
 * Get embeddings for multiple texts using TensorFlow.js
 */
export async function getBatchEmbeddings(texts: string[], config: TensorFlowConfig): Promise<number[][]> {
  try {
    // Load the model
    const model = await loadModel(config);
    
    // Get embeddings
    const embeddings = await model.embed(texts);
    
    // Convert to array
    const embeddingArrays = Array.from(await embeddings.array());
    
    return embeddingArrays;
  } catch (error) {
    console.error('[TensorFlow.js] Error generating batch embeddings:', error);
    throw error;
  }
} 
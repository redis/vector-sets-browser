import { NextRequest, NextResponse } from 'next/server';
import { EmbeddingConfig, MODEL_DIMENSIONS } from '@/app/types/embedding';
import * as tf from '@tensorflow/tfjs';
import * as use from '@tensorflow-models/universal-sentence-encoder';
import { validateAndNormalizeVector } from '@/app/utils/vectorValidation';
import { cookies } from 'next/headers';
import { RedisClient } from '@/app/lib/server/redis-client';
import { getImageEmbedding } from '@/app/utils/imageEmbedding';
import { createCanvas, loadImage } from 'canvas';
import path from 'path';
import fs from 'fs/promises';

// Initialize TensorFlow.js
// Define a proper type for the Universal Sentence Encoder model
type UniversalSentenceEncoderModel = {
  embed: (inputs: string[]) => Promise<tf.Tensor2D>;
};

let useModel: UniversalSentenceEncoderModel | null = null;
let useModelLoading = false;

const REDIS_URL_COOKIE = 'redis_url';
// Single key for all embeddings using Redis Hash
const EMBEDDINGS_HASH_KEY = 'embeddings_cache';
const CACHE_CONFIG_KEY = 'embedding_cache_config';
const CACHE_METADATA_KEY = 'embedding_cache_metadata';
const DEFAULT_CACHE_TTL = 24 * 60 * 60; // 24 hours in seconds

// Default cache configuration
const DEFAULT_CACHE_CONFIG = {
  maxSize: 1000, // Maximum number of entries in the cache
  defaultTTL: DEFAULT_CACHE_TTL, // 24 hours in seconds
  useCache: true, // Default to using cache
};

// Cache metadata to track entry timestamps for LRU eviction
interface CacheMetadata {
  entries: Record<string, { timestamp: number, ttl: number }>;
}

// Helper to get Redis URL from cookies
function getRedisUrl(): string | null {
  const url = cookies().get(REDIS_URL_COOKIE)?.value;
  return url || null;
}

// Get the current cache configuration
async function getCacheConfig() {
  try {
    const url = getRedisUrl();
    if (!url) {
      return DEFAULT_CACHE_CONFIG;
    }

    return await RedisClient.withConnection(url, async (client) => {
      const configStr = await client.get(CACHE_CONFIG_KEY);
      
      if (configStr) {
        // Ensure all required fields are present
        const parsedConfig = JSON.parse(configStr);
        return {
          ...DEFAULT_CACHE_CONFIG,
          ...parsedConfig
        };
      }
      
      // If no config exists, set the default and return it
      await client.set(CACHE_CONFIG_KEY, JSON.stringify(DEFAULT_CACHE_CONFIG));
      return DEFAULT_CACHE_CONFIG;
    }).then(result => {
      if (!result.success) {
        console.error("[Cache] Error getting cache config:", result.error);
        return DEFAULT_CACHE_CONFIG;
      }
      return result.result;
    });
  } catch (error) {
    console.error("[Cache] Error getting cache config:", error);
    return DEFAULT_CACHE_CONFIG;
  }
}

// Get cache metadata
async function getCacheMetadata(): Promise<CacheMetadata> {
  try {
    const url = getRedisUrl();
    if (!url) {
      return { entries: {} };
    }

    return await RedisClient.withConnection(url, async (client) => {
      const metadataStr = await client.get(CACHE_METADATA_KEY);
      
      if (metadataStr) {
        return JSON.parse(metadataStr);
      }
      
      // If no metadata exists, create an empty one
      const emptyMetadata: CacheMetadata = { entries: {} };
      await client.set(CACHE_METADATA_KEY, JSON.stringify(emptyMetadata));
      return emptyMetadata;
    }).then(result => {
      if (!result.success) {
        console.error("[Cache] Error getting cache metadata:", result.error);
        return { entries: {} };
      }
      return result.result;
    });
  } catch (error) {
    console.error("[Cache] Error getting cache metadata:", error);
    return { entries: {} };
  }
}

// Update cache metadata
async function updateCacheMetadata(metadata: CacheMetadata): Promise<void> {
  try {
    const url = getRedisUrl();
    if (!url) {
      return;
    }

    await RedisClient.withConnection(url, async (client) => {
      await client.set(CACHE_METADATA_KEY, JSON.stringify(metadata));
      return true;
    }).then(result => {
      if (!result.success) {
        console.error("[Cache] Error updating cache metadata:", result.error);
      }
    });
  } catch (error) {
    console.error("[Cache] Error updating cache metadata:", error);
  }
}

// Generate a field name for the hash based on provider, model, and text/image
function generateHashField(input: string, config: EmbeddingConfig): string {
  const modelIdentifier = config.provider === 'openai' 
      ? config.openai?.model 
      : config.provider === 'tensorflow' 
          ? config.tensorflow?.model 
          : config.provider === 'ollama'
              ? config.ollama?.modelName
              : config.provider === 'image'
                  ? config.image?.model
                  : '';
  
  // Create a deterministic hash of the input to avoid field name length issues
  // and special character issues in Redis
  const inputHash = Buffer.from(input).toString('base64').substring(0, 40);
  return `${config.provider}:${modelIdentifier}:${inputHash}`;
}

// Enforce the cache size limit by removing oldest entries
async function enforceCacheSizeLimit() {
  try {
    const url = getRedisUrl();
    if (!url) {
      return { removed: 0 };
    }

    const config = await getCacheConfig();
    const metadata = await getCacheMetadata();
    
    // Get all entries and sort by timestamp (oldest first)
    const entries = Object.entries(metadata.entries);
    
    if (entries.length <= config.maxSize) {
      return { removed: 0 };
    }
    
    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Calculate how many entries to remove
    const toRemove = entries.length - config.maxSize;
    const fieldsToRemove = entries.slice(0, toRemove).map(entry => entry[0]);
    
    if (fieldsToRemove.length > 0) {
      await RedisClient.withConnection(url, async (client) => {
        // Remove fields from the hash
        if (fieldsToRemove.length > 0) {
          await client.hDel(EMBEDDINGS_HASH_KEY, fieldsToRemove);
        }
        
        // Update metadata by removing the entries
        fieldsToRemove.forEach(field => {
          delete metadata.entries[field];
        });
        
        await updateCacheMetadata(metadata);
        return true;
      });
    }
    
    return { removed: fieldsToRemove.length };
  } catch (error) {
    console.error("[Cache] Error enforcing cache size limit:", error);
    return { removed: 0 };
  }
}

async function getCachedEmbedding(input: string, config: EmbeddingConfig): Promise<number[] | null> {
  try {
    const url = getRedisUrl();
    if (!url) {
      return null;
    }

    // Check if caching is enabled
    const cacheConfig = await getCacheConfig();
    if (!cacheConfig.useCache) {
      console.log('[Embedding] Cache is disabled, skipping cache lookup');
      return null;
    }

    return await RedisClient.withConnection(url, async (client) => {
      const field = generateHashField(input, config);
      
      const cached = await client.hGet(EMBEDDINGS_HASH_KEY, field);
      
      if (cached) {
        // Update metadata to mark this entry as recently used
        const metadata = await getCacheMetadata();
        if (metadata.entries[field]) {
          metadata.entries[field].timestamp = Date.now();
          await updateCacheMetadata(metadata);
        }
        
        return JSON.parse(cached);
      }
      
      return null;
    }).then(result => {
      if (!result.success) {
        console.error('[Embedding] Cache read error:', result.error);
        return null;
      }
      return result.result;
    });
  } catch (error) {
    console.error('[Embedding] Cache read error:', error);
    return null;
  }
}

async function cacheEmbedding(input: string, embedding: number[], config: EmbeddingConfig): Promise<void> {
  try {
    const url = getRedisUrl();
    if (!url) {
      return;
    }

    // Check if caching is enabled
    const cacheConfig = await getCacheConfig();
    if (!cacheConfig.useCache) {
      console.log('[Embedding] Cache is disabled, skipping cache write');
      return;
    }

    // Use the global TTL setting
    const ttl = cacheConfig.defaultTTL;
    const field = generateHashField(input, config);

    await RedisClient.withConnection(url, async (client) => {
      // Store the embedding in the hash
      await client.hSet(EMBEDDINGS_HASH_KEY, field, JSON.stringify(embedding));
      
      // Update metadata
      const metadata = await getCacheMetadata();
      metadata.entries[field] = {
        timestamp: Date.now(),
        ttl: ttl
      };
      
      await updateCacheMetadata(metadata);
      return true;
    }).then(async result => {
      if (!result.success) {
        console.error('[Embedding] Cache write error:', result.error);
        return;
      }
      
      // Check and enforce cache size limit
      await enforceCacheSizeLimit();
    });
  } catch (error) {
    console.error('[Embedding] Cache write error:', error);
  }
}

// Load TensorFlow.js model
async function loadTensorFlowModel(modelName: string): Promise<UniversalSentenceEncoderModel> {
    if (useModel) return useModel;
    
    if (useModelLoading) {
        // Wait for the model to finish loading
        while (useModelLoading) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (!useModel) {
            throw new Error('TensorFlow.js model failed to load');
        }
        return useModel;
    }
    
    try {
        useModelLoading = true;
        console.log(`[Embedding] Loading TensorFlow.js model: ${modelName}`);
        
        // Ensure TensorFlow.js is initialized
        await tf.ready();
        
        // Load the Universal Sentence Encoder model
        // Cast the model to our custom type to ensure compatibility
        useModel = await use.load() as unknown as UniversalSentenceEncoderModel;
        console.log('[Embedding] TensorFlow.js model loaded successfully');
        if (!useModel) {
            throw new Error('TensorFlow.js model failed to load');
        }
        return useModel;
    } catch (error) {
        console.error('[Embedding] Error loading TensorFlow.js model:', error);
        throw error;
    } finally {
        useModelLoading = false;
    }
}

async function getTensorFlowEmbedding(text: string, config: EmbeddingConfig): Promise<number[]> {
    if (!config.tensorflow) {
        throw new Error('TensorFlow.js configuration is missing');
    }
    
    //Check cache first
    const cached = await getCachedEmbedding(text, config);
    if (cached) {
       console.log('[Embedding] Cache hit - returning cached embedding');
       return cached;
    }
    
    console.log(`[Embedding] Getting TensorFlow.js embedding with model: ${config.tensorflow.model}`);
    
    try {
        // Load the model
        const model = await loadTensorFlowModel(config.tensorflow.model);
        
        // Get embeddings
        const embeddings = await model.embed([text]);
        
        // Convert to array and validate
        const embeddingsArray = await embeddings.arraySync();
        const rawEmbedding = embeddingsArray[0];
        console.log('[Embedding] TensorFlow.js raw embedding:', rawEmbedding);
        // Use our validation utility to normalize and validate the vector
        const validationResult = validateAndNormalizeVector(rawEmbedding, 'tensorflow');
        
        // Log detailed debug information
        console.log('[Embedding] TensorFlow.js vector validation result:', {
            isValid: validationResult.isValid,
            error: validationResult.error,
            debug: validationResult.debug
        });
        
        if (!validationResult.isValid) {
            throw new Error(`Invalid TensorFlow.js embedding: ${validationResult.error}`);
        }
        
        const embedding = validationResult.vector;
        
        // Cache the result
        await cacheEmbedding(text, embedding, config);
        
        console.log(`[Embedding] TensorFlow.js returned embedding of length ${embedding.length}`);
        console.log('[Embedding] Sample values:', embedding.slice(0, 5));
        
        return embedding;
    } catch (error) {
        console.error('[Embedding] TensorFlow.js embedding error:', error);
        throw error;
    }
}

async function getImageModelEmbedding(imageData: string, config: EmbeddingConfig): Promise<number[]> {
    if (!config.image) {
        throw new Error('Image configuration is missing');
    }
    
    // Check cache first
    const cached = await getCachedEmbedding(imageData, config);
    if (cached) {
        console.log('[Embedding] Cache hit - returning cached image embedding');
        return cached;
    }
    
    console.log(`[Embedding] Getting image embedding with model: ${config.image.model}`);
    
    try {
        // Get the embedding using our image embedding utility
        const embedding = await getImageEmbedding(imageData, config.image);
        
        // Validate embedding dimensions
        const expectedDim = MODEL_DIMENSIONS[config.image.model];
        if (embedding.length !== expectedDim) {
            console.error(`[Embedding] Unexpected image embedding dimension: got ${embedding.length}, expected ${expectedDim}`);
            throw new Error(`Unexpected image embedding dimension: got ${embedding.length}, expected ${expectedDim}`);
        }
        
        // Cache the result
        await cacheEmbedding(imageData, embedding, config);
        
        console.log(`[Embedding] Image model returned embedding of length ${embedding.length}`);
        console.log('[Embedding] Sample values:', embedding.slice(0, 5));
        
        return embedding;
    } catch (error) {
        console.error('[Embedding] Image embedding error:', error);
        
        // Provide a clear error message for server-side image processing
        if (error instanceof Error && 
            (error.message.includes('Image is not defined') || 
             error.message.includes('Image processing in server components is not supported'))) {
            throw new Error(
                'Image processing cannot be performed in server components. ' +
                'Please use a client component for image processing.'
            );
        }
        
        throw error;
    }
}

async function getEmbedding(input: string, config: EmbeddingConfig, isImage: boolean = false): Promise<number[]> {
    if (isImage) {
        console.log(`[Embedding] Getting embedding for image data using provider: ${config.provider}`);
    } else {
        console.log(`[Embedding] Getting embedding for text (${input.length} chars) using provider: ${config.provider}`);
    }
    
    if (config.provider === 'none') {
        throw new Error('No embedding provider configured');
    }
    
    if (config.provider === 'image') {
        if (!isImage) {
            throw new Error('Image provider requires image data');
        }
        return await getImageModelEmbedding(input, config);
    } else if (isImage) {
        throw new Error(`Provider ${config.provider} does not support image data`);
    }
    
    if (config.provider === 'ollama' && config.ollama) {
        // Check cache first
        const cached = await getCachedEmbedding(input, config);
        if (cached) {
            console.log('[Embedding] Cache hit - returning cached embedding for Ollama');
            return cached;
        }

        const prompt = config.ollama.promptTemplate?.replace('{text}', input) || input;
        console.log(`[Embedding] Calling Ollama API at ${config.ollama.apiUrl} with model ${config.ollama.modelName}`);
        
        const response = await fetch(config.ollama.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: config.ollama.modelName,
                prompt,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Embedding] Ollama API error: ${response.status} - ${errorText}`);
            throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
        }
        const data = await response.json();

        // Validate and normalize the Ollama embedding
        const validationResult = validateAndNormalizeVector(data.embedding, 'ollama');
        
        // Log detailed debug information
        console.log('[Embedding] Ollama vector validation result:', {
            isValid: validationResult.isValid,
            error: validationResult.error,
            debug: validationResult.debug
        });
        
        if (!validationResult.isValid) {
            throw new Error(`Invalid Ollama embedding: ${validationResult.error}`);
        }
        
        const embedding = validationResult.vector;
        
        // Cache the result
        await cacheEmbedding(input, embedding, config);
        
        console.log(`[Embedding] Ollama returned embedding of length ${embedding.length}`);
        console.log('[Embedding] Sample values:', embedding.slice(0, 5));
        
        return embedding;
    } else if (config.provider === 'openai' && config.openai) {
        // Check cache first
        const cached = await getCachedEmbedding(input, config);
        if (cached) {
            console.log('[Embedding] Cache hit - returning cached embedding');
            return cached;
        }

        console.log(`[Embedding] Calling OpenAI API with model ${config.openai.model}`);
        const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.openai.apiKey}`,
                'OpenAI-Organization': process.env.OPENAI_ORG_ID || '',
            },
            body: JSON.stringify({
                input: input,
                model: config.openai.model,
                encoding_format: 'float',
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Embedding] OpenAI API error: ${response.status} - ${errorText}`);
            throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        const embedding = data.data[0].embedding;
        
        // Validate embedding dimensions
        const expectedDim = MODEL_DIMENSIONS[config.openai.model];
        if (embedding.length !== expectedDim) {
            console.error(`[Embedding] Unexpected embedding dimension: got ${embedding.length}, expected ${expectedDim}`);
            throw new Error(`Unexpected embedding dimension: got ${embedding.length}, expected ${expectedDim}`);
        }

        // Cache the result
        await cacheEmbedding(input, embedding, config);
        
        console.log(`[Embedding] OpenAI returned embedding of length ${embedding.length}`);
        return embedding;
    } else if (config.provider === 'tensorflow' && config.tensorflow) {
        return await getTensorFlowEmbedding(input, config);
    } else {
        console.error(`[Embedding] Unsupported provider: ${config.provider}`);
        throw new Error('Unsupported embedding provider or invalid configuration');
    }
}

export async function POST(request: NextRequest) {
    const startTime = Date.now();
    try {
        const { text, imageData, config } = await request.json();
        
        // Determine if we're processing text or image
        const isImage = !!imageData;
        let input = isImage ? imageData : text;
        
        if (isImage) {
            console.log(`[Embedding] Received request with image data:`, imageData);
            // If imageData is a path starting with /, load it from public directory
            if (typeof imageData === 'string' && imageData.startsWith('/')) {
                const publicPath = path.join(process.cwd(), 'public', imageData);
                console.log(`[Embedding] Loading image from public path:`, publicPath);
                const imageBuffer = await fs.readFile(publicPath);
                input = `data:image/png;base64,${imageBuffer.toString('base64')}`;
            }
        } else {
            console.log(`[Embedding] Received request with text length: ${text?.length || 0}`);
        }
        console.log(`[Embedding] Config:`, config);

        if ((!text && !imageData) || !config) {
            console.error('[Embedding] Missing required fields');
            return NextResponse.json(
                { success: false, error: 'Missing required fields (text or imageData, and config)' },
                { status: 400 }
            );
        }

        const embedding = await getEmbedding(input, config, isImage);
        const duration = Date.now() - startTime;
        console.log(`[Embedding] Request completed in ⏱️ ${duration}ms`);
        return NextResponse.json({ success: true, embedding });
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[Embedding] Error getting embedding (${duration}ms):`, error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
} 
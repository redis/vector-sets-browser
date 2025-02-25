import { NextRequest, NextResponse } from 'next/server';
import { EmbeddingConfig, MODEL_DIMENSIONS } from '@/app/types/embedding';
import { createClient } from 'redis';

// Initialize Redis client
const redis = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redis.on('error', (err) => console.error('Redis Client Error:', err));

// Connect to Redis lazily when needed
async function getRedisClient() {
    if (!redis.isOpen) {
        await redis.connect();
    }
    return redis;
}

const CACHE_PREFIX = 'emb:';
const DEFAULT_CACHE_TTL = 24 * 60 * 60; // 24 hours in seconds

async function getCachedEmbedding(text: string, config: EmbeddingConfig): Promise<number[] | null> {
    if (!config.openai?.cacheTTL) return null;
    
    try {
        const client = await getRedisClient();
        const cacheKey = `${CACHE_PREFIX}${config.provider}:${config.openai?.model}:${text}`;
        const cached = await client.get(cacheKey);
        return cached ? JSON.parse(cached) : null;
    } catch (error) {
        console.error('[Embedding] Cache read error:', error);
        return null;
    }
}

async function cacheEmbedding(text: string, embedding: number[], config: EmbeddingConfig): Promise<void> {
    try {
        const client = await getRedisClient();
        const ttl = config.openai?.cacheTTL || DEFAULT_CACHE_TTL;
        const cacheKey = `${CACHE_PREFIX}${config.provider}:${config.openai?.model}:${text}`;
        await client.setEx(cacheKey, ttl, JSON.stringify(embedding));
    } catch (error) {
        console.error('[Embedding] Cache write error:', error);
    }
}

async function getEmbedding(text: string, config: EmbeddingConfig): Promise<number[]> {
    console.log(`[Embedding] Getting embedding for text (${text.length} chars) using provider: ${config.provider}`);
    
    if (config.provider === 'none') {
        throw new Error('No embedding provider configured');
    }
    
    if (config.provider === 'ollama' && config.ollama) {
        const prompt = config.ollama.promptTemplate?.replace('{text}', text) || text;
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
        console.log(`[Embedding] Ollama returned embedding of length ${data.embedding.length}`);
        return data.embedding;
    } else if (config.provider === 'openai' && config.openai) {
        // Check cache first
        const cached = await getCachedEmbedding(text, config);
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
                input: text,
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
        await cacheEmbedding(text, embedding, config);
        
        console.log(`[Embedding] OpenAI returned embedding of length ${embedding.length}`);
        return embedding;
    } else {
        console.error(`[Embedding] Unsupported provider: ${config.provider}`);
        throw new Error('Unsupported embedding provider or invalid configuration');
    }
}

export async function POST(request: NextRequest) {
    const startTime = Date.now();
    try {
        const { text, config } = await request.json();
        console.log(`[Embedding] Received request with text length: ${text?.length || 0}`);
        console.log(`[Embedding] Config:`, config);

        if (!text || !config) {
            console.error('[Embedding] Missing required fields');
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const embedding = await getEmbedding(text, config);
        const duration = Date.now() - startTime;
        console.log(`[Embedding] Request completed in ⏱️ ${duration}ms`);
        return NextResponse.json(embedding);
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[Embedding] Error getting embedding (${duration}ms):`, error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
} 
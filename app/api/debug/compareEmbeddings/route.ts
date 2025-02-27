import { NextRequest, NextResponse } from 'next/server';
import { EmbeddingConfig } from '@/app/types/embedding';
import { compareVectorFormats } from '@/app/utils/vectorValidation';

/**
 * API endpoint to compare embeddings from different providers
 * This is useful for debugging issues with vector formats
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { text, configs } = body;

        if (!text) {
            return NextResponse.json({ error: 'No text provided' }, { status: 400 });
        }

        if (!configs || !Array.isArray(configs) || configs.length < 2) {
            return NextResponse.json({ 
                error: 'At least two embedding configurations are required for comparison' 
            }, { status: 400 });
        }

        // Get embeddings from each provider
        const embeddings: { provider: string; embedding: number[] }[] = [];
        
        for (const config of configs) {
            try {
                const response = await fetch(`${req.nextUrl.origin}/api/embedding`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text,
                        config,
                    }),
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`API error: ${response.status} - ${errorText}`);
                }

                const data = await response.json();
                if (!data.success) {
                    throw new Error(data.error || 'Failed to get embedding');
                }

                embeddings.push({
                    provider: getProviderName(config),
                    embedding: data.embedding,
                });
            } catch (error) {
                console.error(`Error getting embedding for ${getProviderName(config)}:`, error);
                embeddings.push({
                    provider: getProviderName(config),
                    embedding: [],
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }

        // Compare embeddings
        const comparisons: any[] = [];
        
        for (let i = 0; i < embeddings.length; i++) {
            for (let j = i + 1; j < embeddings.length; j++) {
                const embedding1 = embeddings[i];
                const embedding2 = embeddings[j];
                
                if (embedding1.embedding.length === 0 || embedding2.embedding.length === 0) {
                    comparisons.push({
                        providers: [embedding1.provider, embedding2.provider],
                        error: 'One or both embeddings failed to generate',
                    });
                    continue;
                }
                
                const comparison = compareVectorFormats(embedding1.embedding, embedding2.embedding);
                
                comparisons.push({
                    providers: [embedding1.provider, embedding2.provider],
                    ...comparison,
                });
            }
        }

        return NextResponse.json({
            embeddings: embeddings.map(e => ({
                provider: e.provider,
                length: e.embedding.length,
                sample: e.embedding.slice(0, 5),
                error: e.error,
            })),
            comparisons,
        });
    } catch (error) {
        console.error('Error comparing embeddings:', error);
        return NextResponse.json({ 
            error: error instanceof Error ? error.message : String(error) 
        }, { status: 500 });
    }
}

function getProviderName(config: EmbeddingConfig): string {
    if (config.provider === 'tensorflow' && config.tensorflow) {
        return `tensorflow-${config.tensorflow.model}`;
    } else if (config.provider === 'ollama' && config.ollama) {
        return `ollama-${config.ollama.modelName}`;
    } else if (config.provider === 'openai' && config.openai) {
        return `openai-${config.openai.model}`;
    } else {
        return config.provider;
    }
} 
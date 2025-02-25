import { NextRequest, NextResponse } from 'next/server';
import RedisClient from '@/app/lib/server/redis-client';
import { EmbeddingConfig } from '@/app/types/embedding';
import { cookies } from 'next/headers';

const REDIS_URL_COOKIE = 'redis_url';

// Helper to get the base URL for server-side API calls
function getBaseUrl() {
    return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
}

function getRedisUrl(): string {
    const url = cookies().get(REDIS_URL_COOKIE)?.value;
    if (!url) {
        throw new Error('No Redis connection available');
    }
    return url;
}

async function getEmbedding(text: string, config: EmbeddingConfig): Promise<number[]> {
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/api/embedding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text,
            config
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to get embedding: ${response.statusText}`);
    }

    return response.json();
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { text, config, vectorSetName } = body;

        if (!text) {
            return NextResponse.json({ error: 'No text provided' }, { status: 400 });
        }

        const url = getRedisUrl();
        
        // Get the expected dimension from Redis
        const dimResult = await RedisClient.withConnection(url, async (client) => {
            return client.sendCommand(["VDIM", vectorSetName]);
        });

        if (!dimResult.success) {
            return NextResponse.json({ error: dimResult.error }, { status: 400 });
        }
        const expectedDim = dimResult.result;
        
        // Get a test embedding
        const embedding = await getEmbedding(text, config);
        
        if (embedding.length !== expectedDim) {
            return NextResponse.json({
                error: `Vector dimension mismatch - embeddings from this CSV will be ${embedding.length} dimensions, but your vector set requires ${expectedDim} dimensions.`
            }, { status: 400 });
        }

        return NextResponse.json({
            isValid: true,
            dimensions: {
                expected: expectedDim,
                actual: embedding.length
            }
        });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
} 
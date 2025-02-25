import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const REDIS_URL_COOKIE = 'redis_url';

// Helper to get Redis URL for validation
function getRedisUrl(): string {
    const url = cookies().get(REDIS_URL_COOKIE)?.value;
    if (!url) {
        throw new Error('No Redis connection available');
    }
    return url;
}

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const jobId = url.searchParams.get('jobId');

    if (!jobId) {
        return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    try {
        // Forward to jobs API
        const response = await fetch(`${url.origin}/api/jobs?jobId=${jobId}`, {
            method: 'GET',
            headers: {
                'Cookie': `${REDIS_URL_COOKIE}=${getRedisUrl()}`
            }
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error('Error getting job progress:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const url = new URL(req.url);
    const jobId = url.searchParams.get('jobId');

    if (!jobId) {
        return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    try {
        // Forward to jobs API
        const response = await fetch(`${url.origin}/api/jobs?jobId=${jobId}`, {
            method: 'DELETE',
            headers: {
                'Cookie': `${REDIS_URL_COOKIE}=${getRedisUrl()}`
            }
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error('Error cancelling job:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const url = new URL(req.url);
        
        // Forward the request to jobs API
        const response = await fetch(`${url.origin}/api/jobs`, {
            method: 'POST',
            headers: {
                ...Object.fromEntries(req.headers),
                'Cookie': `${REDIS_URL_COOKIE}=${getRedisUrl()}`
            },
            body: req.body,
            duplex: 'half'  // Required when sending a body
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error('Error in import:', error);
        return NextResponse.json({ 
            error: String(error),
            stack: (error as Error).stack
        }, { status: 500 });
    }
} 
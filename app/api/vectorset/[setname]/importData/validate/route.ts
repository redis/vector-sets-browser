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

// POST /api/vectorset/[setname]/importData/validate - Validate import data
export async function POST(
    req: NextRequest,
    { params }: { params: { setname: string } }
) {
    try {
        const url = new URL(req.url);
        const vectorSetName = params.setname;
        
        // Forward to the validation endpoint
        const response = await fetch(`${url.origin}/api/jobs/validate`, {
            method: 'POST',
            headers: {
                ...Object.fromEntries(req.headers),
                'Cookie': `${REDIS_URL_COOKIE}=${getRedisUrl()}`
            },
            body: req.body,
            duplex: 'half'
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error('Error in validation:', error);
        return NextResponse.json({ 
            error: String(error),
            stack: (error as Error).stack
        }, { status: 500 });
    }
} 
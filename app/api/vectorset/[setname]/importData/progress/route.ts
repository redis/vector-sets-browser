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

// GET /api/vectorset/[setname]/importData/progress - Get import progress as server-sent events
export async function GET(
    req: NextRequest,
    { params }: { params: { setname: string } }
) {
    try {
        const url = new URL(req.url);
        const vectorSetName = params.setname;
        
        // Forward to the progress endpoint
        const response = await fetch(`${url.origin}/api/jobs/progress`, {
            method: 'GET',
            headers: {
                'Cookie': `${REDIS_URL_COOKIE}=${getRedisUrl()}`
            }
        });

        // Return the response as-is to maintain the event stream
        return new Response(response.body, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        });
    } catch (error) {
        console.error('Error in progress stream:', error);
        
        // Return an error event
        return new Response(
            `data: ${JSON.stringify({ error: String(error) })}\n\n`, 
            {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                }
            }
        );
    }
} 
import { RedisConnection } from '@/lib/redis-server/RedisConnection';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const REDIS_URL_COOKIE = 'redis_url';
const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
};

// Test connection without storing state
async function testConnection(url: string): Promise<boolean> {
    const result = await RedisConnection.withClient(url, async (client) => {
        await client.ping();
        return true;
    });
    return result.success;
}

export async function POST(request: Request) {
    try {
        const { url } = await request.json();
        
        if (!url) {
            return NextResponse.json(
                { error: "URL is required" },
                { status: 400 }
            );
        }

        // Test the connection first
        const isConnected = await testConnection(url);
        if (!isConnected) {
            return NextResponse.json(
                { error: "Failed to connect to Redis" },
                { status: 500 }
            );
        }

        // Set the cookie with the Redis URL
        (await cookies()).set(REDIS_URL_COOKIE, url, COOKIE_OPTIONS);
        
        return NextResponse.json({ 
            success: true,
            message: "Connected successfully",
            url 
        });
    } catch (error) {
        console.error("Redis connection error:", error);
        return NextResponse.json(
            { 
                error: error instanceof Error ? error.message : "Failed to connect to Redis" 
            },
            { status: 500 }
        );
    }
}

export async function GET() {
    try {
        const storedUrl = (await cookies()).get(REDIS_URL_COOKIE)?.value;
        
        if (!storedUrl) {
            return NextResponse.json(
                { error: "No active connection" },
                { status: 404 }
            );
        }

        // Verify the connection is still valid
        const isConnected = await testConnection(storedUrl);
        if (!isConnected) {
            (await cookies()).delete(REDIS_URL_COOKIE);
            return NextResponse.json(
                { error: "Stored connection is no longer valid" },
                { status: 404 }
            );
        }
        
        return NextResponse.json({ 
            success: true,
            message: "Connection verified",
            url: storedUrl
        });
    } catch (error) {
        console.error("Redis connection check error:", error);
        return NextResponse.json(
            { 
                error: error instanceof Error ? error.message : "Failed to check Redis connection" 
            },
            { status: 500 }
        );
    }
}

export async function DELETE() {
    try {
        (await cookies()).delete(REDIS_URL_COOKIE);
        return NextResponse.json({ 
            success: true,
            message: "Disconnected successfully" 
        });
    } catch (error) {
        console.error("Redis disconnection error:", error);
        return NextResponse.json(
            { 
                error: error instanceof Error ? error.message : "Failed to disconnect from Redis" 
            },
            { status: 500 }
        );
    }
} 
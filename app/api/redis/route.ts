import { NextResponse } from "next/server"

import { cookies } from 'next/headers'
import { RedisClient } from '@/app/lib/server/redis-client'
import * as redis from '@/app/lib/server/redis-client'

const REDIS_URL_COOKIE = 'redis_url'
const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24,
}

// Helper to get Redis URL from cookies
function getRedisUrl(): string | null {
    const url = cookies().get(REDIS_URL_COOKIE)?.value
    return url || null
}

// Helper to handle Redis operations with proper error handling
async function handleRedisOperation<T>(operation: (url: string) => Promise<T>): Promise<NextResponse> {
    try {
        const url = getRedisUrl();
        if (!url) {
            return NextResponse.json(
                { error: 'No Redis connection available' },
                { status: 401 }
            )
        }

        const result = await operation(url);
        
        // Return the result directly since it's already wrapped by RedisClient.withConnection
        const response = NextResponse.json(result);
        
        // Ensure the cookie is set in the response
        response.cookies.set(REDIS_URL_COOKIE, url, COOKIE_OPTIONS);
        
        return response;
    } catch (error) {
        console.error('Redis operation failed:', error)
        // If the error is about no connection, return 401
        if (error instanceof Error && error.message.includes('No Redis connection available')) {
            return NextResponse.json(
                { error: 'No Redis connection available' },
                { status: 401 }
            )
        }
        // For other errors, return 500
        return NextResponse.json(
            { error: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        )
    }
}

// Test connection without storing state
async function testConnection(url: string): Promise<boolean> {
    console.log('Testing Redis connection to:', url);
    return RedisClient.withConnection(url, async (client) => {
        // Try to execute a simple command to verify connection
        await client.ping();
        console.log('Redis connection test successful');
        return true;
    })
    .then(result => {
        console.log('Connection test result:', result);
        return result.success;
    })
    .catch(error => {
        console.error('Connection test failed:', error);
        return false;
    });
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Handle connection request
    if ('url' in body) {
      const { url } = body
      if (!url) {
        return NextResponse.json(
          { error: "URL is required" },
          { status: 400 }
        )
      }

      console.log('Attempting to connect to Redis at:', url);
      // Test the connection first
      const isConnected = await testConnection(url)
      if (!isConnected) {
        console.error('Failed to establish Redis connection');
        return NextResponse.json(
          { error: "Failed to connect to Redis" },
          { status: 500 }
        )
      }

      // Set the cookie with the Redis URL
      cookies().set(REDIS_URL_COOKIE, url, COOKIE_OPTIONS)
      console.log('Redis connection established and cookie set');
      
      return NextResponse.json({ 
        success: true,
        message: "Connected successfully",
        url 
      })
    }

    // Handle vector operations
    const { action, params } = body
    if (!action) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    //const url = getRedisUrl()
    //console.log("Redis operation request:", { action, params, url })

    switch (action) {
      case "createVectorSet":
        console.log("Creating vector set:", params);
        return handleRedisOperation((url) => redis.createVectorSet(
          url,
          params.keyName,
          params.dimensions,
          params.metadata,
          params.customData
        ))

      case "deleteVectorSet":
        return handleRedisOperation((url) => redis.deleteVectorSet(url, params.keyName))

      case "vadd":
        return handleRedisOperation((url) => redis.vadd(url, params.keyName, params.element, params.vector))

      case "vsim":
        return handleRedisOperation((url) =>
            redis.vsim(url, params.keyName, {
                searchVector: params.vector,
                searchElement: params.searchElement,
                count: params.count,
            })
        )

      case "vdim":
        return handleRedisOperation((url) => redis.vdim(url, params.keyName))

      case "vcard":
        return handleRedisOperation((url) => redis.vcard(url, params.keyName))

      case "vrem":
        return handleRedisOperation((url) => redis.vrem(url, params.keyName, params.element))

      case "vemb":
        return handleRedisOperation((url) => redis.vemb(url, params.keyName, params.element))

      case "getRedisInfo":
        return handleRedisOperation((url) => redis.getRedisInfo(url))

      case "getMetadata":
        return handleRedisOperation((url) => redis.getMetadata(url, params.keyName))

      case "setMetadata":
        return handleRedisOperation((url) => redis.setMetadata(url, params.keyName, params.metadata))

      case "memoryUsage":
        return handleRedisOperation((url) => redis.getMemoryUsage(url, params.keyName))

      case "scanVectorSets":
        return handleRedisOperation((url) => redis.scanVectorSets(url))

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Error in Redis API:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const storedUrl = cookies().get(REDIS_URL_COOKIE)?.value
    
    if (!storedUrl) {
      return NextResponse.json(
        { error: "No active connection" },
        { status: 404 }
      )
    }

    // Verify the connection is still valid
    const isConnected = await testConnection(storedUrl)
    if (!isConnected) {
      cookies().delete(REDIS_URL_COOKIE)
      return NextResponse.json(
        { error: "Stored connection is no longer valid" },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ 
      success: true,
      message: "Connection verified",
      url: storedUrl
    })
  } catch (error) {
    console.error("Redis connection check error:", error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Failed to check Redis connection" 
      },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    cookies().delete(REDIS_URL_COOKIE)
    return NextResponse.json({ 
      success: true,
      message: "Disconnected successfully" 
    })
  } catch (error) {
    console.error("Redis disconnection error:", error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Failed to disconnect from Redis" 
      },
      { status: 500 }
    )
  }
}


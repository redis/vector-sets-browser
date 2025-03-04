import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import * as redis from "@/app/lib/server/redis-client"

// Helper to get Redis URL from cookies
function getRedisUrl(): string | null {
    const url = cookies().get("redis_url")?.value
    return url || null
}

// Type definitions for the request body
interface VlinkRequestBody {
    keyName: string
    element: string
    count?: number
    withEmbeddings?: boolean
}

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as VlinkRequestBody
        const { keyName, element, count = 10, withEmbeddings = false } = body

        if (!keyName || !element) {
            return NextResponse.json(
                { success: false, error: "Key name and element are required" },
                { status: 400 }
            )
        }

        const url = getRedisUrl()
        if (!url) {
            return NextResponse.json(
                { success: false, error: "No Redis connection available" },
                { status: 401 }
            )
        }

        const result = await redis.vlinks(url, keyName, element, count)

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 500 }
            )
        }
        // format of result.result is [[[id, score, vector], [id, score, vector]], [[id, score, vector], [id, score, vector]]]
        // lets output it for debugging
        // output the first element of the first sub-array
        for (const subArray of result.result) { 
            for (const element of subArray) {
                console.log("VLINKS result", element)
            }
        }

        let links = result.result || []

        if (withEmbeddings) {
            // Collect all unique IDs across all levels
            const allIds = Array.from(new Set(
                links.flatMap(level => level.map(([id]) => id))
            ));
            
            // Single batch fetch for all embeddings
            const embResults = await redis.vembBatch(url, keyName, allIds);
            
            if (embResults.success) {
                // Create a map of id -> embedding for quick lookup
                const embeddingMap = new Map(
                    allIds.map((id, index) => [id, embResults.result[index]])
                );
                
                // Process each level using the map
                const processedLinks = links.map(level => 
                    level.map(([id, score]) => 
                        [id, score, embeddingMap.get(id)] as [string, number, number[] | null]
                    )
                );
                links = processedLinks;
            }
        }

        return NextResponse.json({
            success: true,
            result: links
        })
    } catch (error) {
        console.error("Error in VLINKS API:", error)
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        )
    }
}

// Also support GET requests for compatibility with existing code
export async function GET(request: Request) {
    const url = new URL(request.url)
    const node = url.searchParams.get('node')
    const withEmbeddings = url.searchParams.get('withembeddings') === '1'
    const count = parseInt(url.searchParams.get('count') || '10', 10)
    
    if (!node) {
        return NextResponse.json(
            { success: false, error: "Node parameter is required" },
            { status: 400 }
        )
    }
    
    const redisUrl = getRedisUrl()
    if (!redisUrl) {
        return NextResponse.json(
            { success: false, error: "No Redis connection available" },
            { status: 401 }
        )
    }
    
    try {
        // Extract key name and element from the node parameter
        // Assuming format is "keyName:element"
        const [keyName, element] = node.split(':')
        
        if (!keyName || !element) {
            return NextResponse.json(
                { success: false, error: "Invalid node format. Expected 'keyName:element'" },
                { status: 400 }
            )
        }
        
        const result = await redis.vlinks(redisUrl, keyName, element, count)
        
        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 500 }
            )
        }

        let links = result.result || []

        if (withEmbeddings) {
            // Collect all unique IDs across all levels
            const allIds = Array.from(new Set(
                links.flatMap(level => level.map(([id]) => id))
            ));
            
            // Single batch fetch for all embeddings
            const embResults = await redis.vembBatch(redisUrl, keyName, allIds);
            
            if (embResults.success) {
                // Create a map of id -> embedding for quick lookup
                const embeddingMap = new Map(
                    allIds.map((id, index) => [id, embResults.result[index]])
                );
                
                // Process each level using the map
                const processedLinks = links.map(level => 
                    level.map(([id, score]) => 
                        [id, score, embeddingMap.get(id)] as [string, number, number[] | null]
                    )
                );
                links = processedLinks;
            }
        }
        
        return NextResponse.json({
            success: true,
            result: links
        })
    } catch (error) {
        console.error("Error in VLINKS API (GET):", error)
        return NextResponse.json(
            { 
                success: false,
                error: error instanceof Error ? error.message : String(error) 
            },
            { status: 500 }
        )
    }
} 
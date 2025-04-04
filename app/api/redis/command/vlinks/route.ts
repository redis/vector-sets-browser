import { VlinksRequestBody } from "@/app/redis-server/api"
import * as redis from "@/app/redis-server/server/commands"
import { getRedisUrl } from "@/app/redis-server/server/commands"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as VlinksRequestBody
        const { keyName, element, count = 10, withEmbeddings = false } = body

        if (!keyName || !element) {
            return NextResponse.json(
                { success: false, error: "Key name and element are required" },
                { status: 400 }
            )
        }

        const redisUrl = await getRedisUrl()
        
        if (!redisUrl) {
            return NextResponse.json(
                { success: false, error: "No Redis connection available" },
                { status: 401 }
            )
        }

        const response = await redis.vlinks(redisUrl, keyName, element, count)

        if (!response.success) {
            return NextResponse.json(
                { success: false, error: response.error },
                { status: 500 }
            )
        }

        console.log("vlinks response", response)
        let links = response.result || []
        if (withEmbeddings) {
            // Collect all unique IDs across all levels
            const allIds = Array.from(new Set(
                links.flatMap(level => level.map(([id]) => id))
            ));
            
            // Single batch fetch for all embeddings
            const embResults = await redis.vemb_multi(redisUrl, keyName, allIds)
            
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
            } else {
                console.error("EMBEDDINGS FAILURE")
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
    
    const redisUrl = await getRedisUrl()
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
        
        const response = await redis.vlinks(redisUrl, keyName, element, count)
        
        if (!response.success) {
            return NextResponse.json(
                { success: false, error: response.error },
                { status: 500 }
            )
        }

        let links = response.result || []

        if (withEmbeddings) {
            // Collect all unique IDs across all levels
            const allIds = Array.from(new Set(
                links.flatMap(level => level.map(([id]) => id))
            ));
            
            // Single batch fetch for all embeddings
            const embResults = await redis.vemb_multi(redisUrl, keyName, allIds)
            
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
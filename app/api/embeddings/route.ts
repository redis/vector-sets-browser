import { NextRequest, NextResponse } from "next/server"
import { EmbeddingService } from "@/app/embeddings/service"
import { EmbeddingRequestBody } from "@/app/embeddings/types/response"

const embeddingService = new EmbeddingService()

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as EmbeddingRequestBody
        
        if (!body.config) {
            return NextResponse.json(
                { error: "Missing embedding configuration" },
                { status: 400 }
            )
        }

        // Get user-provided API key from headers if available
        const userApiKey = request.headers.get("X-OpenAI-Key");

        // Handle text embedding
        if (body.text) {
            const startTime = performance.now()
            const embedding = await embeddingService.getEmbedding(body.text, body.config, false, userApiKey)
            const endTime = performance.now()
            console.log("Embedding length:", embedding.length)
            return NextResponse.json({
                success: true,
                result: embedding,
                executionTimeMs: endTime - startTime
            })
        }
        
        // Handle image embedding
        if (body.imageData) {
            const startTime = performance.now()
            const embedding = await embeddingService.getEmbedding(body.imageData, body.config, true, userApiKey)
            const endTime = performance.now()
            
            return NextResponse.json({
                success: true,
                result: embedding,
                executionTimeMs: endTime - startTime
            })
        }

        return NextResponse.json(
            { error: "Missing text or image data" },
            { status: 400 }
        )
    } catch (error) {
        console.error("[API] Embedding error:", error)
        return NextResponse.json(
            { 
                success: false,
                error: error instanceof Error ? error.message : "Unknown error" 
            },
            { status: 500 }
        )
    }
}

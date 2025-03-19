import { NextRequest, NextResponse } from "next/server"
import { EmbeddingService } from "@/app/embeddings/service"
import { EmbeddingConfig } from "@/app/embeddings/types/config"

interface BatchEmbeddingRequestBody {
    texts: string[]
    config: EmbeddingConfig
}

const embeddingService = new EmbeddingService()

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as BatchEmbeddingRequestBody
        
        if (!body.config) {
            return NextResponse.json(
                { error: "Missing embedding configuration" },
                { status: 400 }
            )
        }

        if (!body.texts || !Array.isArray(body.texts) || body.texts.length === 0) {
            return NextResponse.json(
                { error: "Missing or invalid texts array" },
                { status: 400 }
            )
        }

        const startTime = performance.now()
        const embeddings = await embeddingService.getBatchEmbeddings(body.texts, body.config)
        const endTime = performance.now()
        
        return NextResponse.json({
            success: true,
            result: embeddings,
            executionTimeMs: endTime - startTime
        })
    } catch (error) {
        console.error("[API] Batch embedding error:", error)
        return NextResponse.json(
            { 
                success: false,
                error: error instanceof Error ? error.message : "Unknown error" 
            },
            { status: 500 }
        )
    }
} 
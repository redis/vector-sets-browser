import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import * as redis from "@/app/lib/server/redis-client"

// Helper to get Redis URL from cookies
function getRedisUrl(): string | null {
    const url = cookies().get("redis_url")?.value
    return url || null
}

// Type definitions for the request body
interface VsimRequestBody {
    keyName: string
    searchInput: number[] | string
    count: number
}

export async function POST(request: Request) {
    try {
        const body = await request.json() as VsimRequestBody
        const { keyName, searchInput, count } = body

        if (!keyName) {
            console.error("[vsim] Key name is required")
            return NextResponse.json(
                { success: false, error: "Key name is required" },
                { status: 400 }
            )
        }

        if (!searchInput) {
            console.error("[vsim] Search input in required")
            return NextResponse.json(
                { success: false, error: "Search input is required" },
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

        // Construct params based on searchInput type
        const params = {
            searchVector: Array.isArray(searchInput) ? searchInput : undefined,
            searchElement: typeof searchInput === 'string' ? searchInput : undefined,
            count: count || 10
        }
        console.log("[vsim] Calling redis.vsim ", url, keyName, params)   
        const result = await redis.vsim(url, keyName, params)

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 500 }
            )
        }

        // Filter out any results with invalid IDs
        const validResults = Array.isArray(result.result) 
            ? result.result.filter((item) => {
                if (!Array.isArray(item) || item.length !== 2) return false
                const [id, score] = item
                if (!id || typeof id !== "string") return false
                if (typeof score !== "number" && typeof score !== "string") return false
                return true
              })
            : []

        // Return just the IDs and scores
        const formattedResults = validResults.map(([id, score]) => [id, Number(score)])

        return NextResponse.json({
            success: true,
            result: formattedResults
        })
    } catch (error) {
        console.error("Error in VSIM API:", error)
        return NextResponse.json(
            { 
                success: false,
                error: error instanceof Error ? error.message : String(error) 
            },
            { status: 500 }
        )
    }
} 
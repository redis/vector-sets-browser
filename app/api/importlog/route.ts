import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import RedisClient from "@/app/lib/server/redis-client";

const REDIS_URL_COOKIE = "redis_url";

// Helper to get Redis URL with error handling
function getRedisUrlOrError(): { url: string } | { error: string } {
    const url = cookies().get(REDIS_URL_COOKIE)?.value;
    if (!url) {
        return { error: "Redis URL not configured" };
    }
    return { url };
}

// GET /api/importlog - Get import logs
export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const vectorSetName = url.searchParams.get("vectorSetName");
    const limit = parseInt(url.searchParams.get("limit") || "10", 10);
    
    const redisResult = getRedisUrlOrError();
    if ("error" in redisResult) {
        return NextResponse.json({ success: false, error: redisResult.error }, { status: 400 });
    }
    
    try {
        const result = await RedisClient.withConnection(redisResult.url, async (client) => {
            // If vectorSetName is provided, get logs for that specific vector set
            // Otherwise, get global logs
            const logKey = vectorSetName 
                ? `vectorset:${vectorSetName}:importlog` 
                : 'global:importlog';
            
            // Get the most recent logs (up to the limit)
            const logs = await client.lRange(logKey, -limit, -1);
            
            // Parse the JSON strings into objects
            return logs.map(log => JSON.parse(log)).reverse();
        });
        
        if (!result.success) {
            return NextResponse.json({ success: false, error: result.error }, { status: 500 });
        }
        
        return NextResponse.json({
            success: true,
            result: result.result
        });
    } catch (error) {
        console.error("Error getting import logs:", error);
        return NextResponse.json({ 
            success: false, 
            error: String(error) 
        }, { status: 500 });
    }
} 
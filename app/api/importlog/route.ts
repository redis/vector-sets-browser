import { NextRequest, NextResponse } from "next/server";
import { RedisClient, getRedisUrl } from "@/app/redis-server/server/commands";

// GET /api/importlog - Get import logs
export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const vectorSetName = url.searchParams.get("vectorSetName");
    const limit = parseInt(url.searchParams.get("limit") || "10", 10);
    
    const redisUrl = getRedisUrl();

    if (!redisUrl) {
        return NextResponse.json({ success: false, error: "No Redis URL configured" }, { status: 400 });
    }

    try {
        const result = await RedisClient.withConnection(redisUrl, async (client) => {
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
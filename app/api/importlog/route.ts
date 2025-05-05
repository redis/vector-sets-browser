import { NextRequest, NextResponse } from "next/server";
import { RedisConnection, getRedisUrl } from "@/lib/redis-server/RedisConnection";

// GET /api/importlog - Get import logs
export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const vectorSetName = url.searchParams.get("vectorSetName");
    const limit = parseInt(url.searchParams.get("limit") || "10", 10);
    
    const redisUrl = await getRedisUrl();

    if (!redisUrl) {
        return NextResponse.json({ success: false, error: "No Redis URL configured" }, { status: 400 });
    }

    try {
        const result = await RedisConnection.withClient(redisUrl, async (client) => {
            // Always get from global import log
            const logs = await client.lRange('global:importlog', -500, -1);
            
            // Parse the JSON strings into objects
            const parsedLogs = logs.map(log => JSON.parse(log)).reverse();
            
            // Filter by vector set name if provided
            const filteredLogs = vectorSetName 
                ? parsedLogs.filter(log => log.vectorSetName === vectorSetName)
                : parsedLogs;
            
            // Return only up to the limit
            return filteredLogs.slice(0, limit);
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
import { RedisClient } from "@/app/redis-server/server/commands"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

const REDIS_URL_COOKIE = "redis_url"

// Test connection without storing state
async function testConnection(url: string): Promise<boolean> {
    return RedisClient.withConnection(url, async (client) => {
        // Try to execute a simple command to verify connection
        await client.ping()
        return true
    })
        .then((result) => {
            return result.success
        })
        .catch((error) => {
            console.error("Connection test failed:", error)
            return false
        })
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
            url: storedUrl,
        })
    } catch (error) {
        console.error("Redis connection check error:", error)
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to check Redis connection",
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
            message: "Disconnected successfully",
        })
    } catch (error) {
        console.error("Redis disconnection error:", error)
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to disconnect from Redis",
            },
            { status: 500 }
        )
    }
}

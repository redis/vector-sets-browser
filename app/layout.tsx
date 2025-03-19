"use client"

import { useEffect, useState } from "react"
import { toast, Toaster } from "sonner"
import TopNav from "./TopNav"
import "./globals.css"
import { RedisService } from "./redis-server/connect"

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const [redisUrl, setRedisUrl] = useState<string | null>(null)
    const [isConnected, setIsConnected] = useState(false)
    const [isConnecting, setIsConnecting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleConnect = async (url: string) => {
        setIsConnecting(true)
        setError(null)
        try {
            await RedisService.connect(url)
            setRedisUrl(url)
            setIsConnected(true)
            toast.success("Connected to Redis")
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to connect to Redis"
            setError(errorMessage)
            toast.error(errorMessage)
            setIsConnected(false)
        } finally {
            setIsConnecting(false)
        }
    }

    // Disconnect when component unmounts
    useEffect(() => {
        return () => {
            RedisService.disconnect().catch(console.error)
        }
    }, [])

    return (
        <html lang="en">
            <body>
                <div className="min-h-screen bg-gray-100 flex flex-col">
                    <TopNav 
                        redisUrl={redisUrl}
                        isConnected={isConnected}
                        isConnecting={isConnecting}
                        onConnect={handleConnect}
                        error={error}
                    />
                    <div className="flex-1">
                        {children}
                    </div>
                </div>
                <Toaster />
            </body>
        </html>
    )
}

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import RedisConnectionList from "../components/RedisConnectionList"
import { useRedisConnection } from "../hooks/useRedisConnection"
import { storeConnection, cleanupOldConnections } from "../lib/connectionManager"
import { toast } from "sonner"

export default function HomePage() {
    const router = useRouter()
    const { redisUrl, handleConnect, isInitializing, statusMessage } = useRedisConnection()
    const [isConnecting, setIsConnecting] = useState(false)

    const handleConnectionSuccess = async (url: string) => {
        setIsConnecting(true)
        try {
            // Clean up old connections first
            cleanupOldConnections()
            
            // Try to connect to Redis
            const success = await handleConnect(url)
            
            if (success) {
                // Store connection details and get connection ID
                const connectionId = storeConnection(url)
                
                // Redirect to vectorset page with the connection ID
                router.push(`/vectorset?cid=${connectionId}`)
            } else {
                toast.error(statusMessage || "Failed to connect to Redis")
            }
        } catch (error) {
            console.error("Connection error:", error)
            toast.error("Failed to connect to Redis")
        } finally {
            setIsConnecting(false)
        }
    }

    if (isInitializing) {
        return (
            <div className="flex items-center justify-center w-full h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
        )
    }

    return (
            <RedisConnectionList
                onConnect={handleConnectionSuccess}
                currentUrl={redisUrl}
                isConnecting={isConnecting}
            />
    )
} 
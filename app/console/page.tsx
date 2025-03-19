"use client"

import { Card } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useRedisConnection } from "../hooks/useRedisConnection"
import {
    cleanupOldConnections,
    storeConnection,
} from "../redis-server/connectionManager"
import RedisConnectionList from "./RedisConnectionList"

export default function ConsolePage() {
    const router = useRouter()
    const { redisUrl, handleConnect, isInitializing, statusMessage } =
        useRedisConnection()
    const [isConnecting, setIsConnecting] = useState(false)
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const connectionListRef = useRef<{
        setIsAddDialogOpen: (open: boolean) => void
    } | null>(null)

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
                window.location.href = `/vectorset?cid=${connectionId}`
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

    const openAddServerDialog = () => {
        if (connectionListRef.current) {
            connectionListRef.current.setIsAddDialogOpen(true)
        }
    }

    useEffect(() => {
        router.push("/console")
    }, [router])

    if (isInitializing) {
        return (
            <div className="flex items-center justify-center w-full h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
        )
    }

    return (
        <div className="flex items-center justify-center min-h-screen">
            <Card className="max-w-3xl min-w-3xl w-full mx-auto">
                <RedisConnectionList
                    ref={connectionListRef}
                    onConnect={handleConnectionSuccess}
                    currentUrl={redisUrl}
                    isConnecting={isConnecting}
                    isAddDialogOpen={isAddDialogOpen}
                    setIsAddDialogOpen={setIsAddDialogOpen}
                />
            </Card>
        </div>
    )
}

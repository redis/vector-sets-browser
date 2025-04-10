import { userSettings } from "@/app/utils/userSettings"
import { useCallback, useEffect, useState } from "react"

interface UseRedisConnectionReturn {
    redisUrl: string | null
    isConnected: boolean
    showVectorSets: boolean
    statusMessage: string
    handleConnect: (url: string) => Promise<boolean>
    setRedisUrl: (url: string) => void
    setShowVectorSets: (show: boolean) => void
    disconnect: () => Promise<void>
    isInitializing: boolean
    updateState: (newState: Partial<StoredConnectionState>) => void
    clearState: () => void
}

const STORAGE_KEY = "redisConnection"

interface StoredConnectionState {
    redisUrl: string
    showVectorSets: boolean
}

export function useRedisConnection(
    initialUrl?: string
): UseRedisConnectionReturn {
    const [redisUrl, setRedisUrl] = useState<string | null>(initialUrl || null)
    const [isConnected, setIsConnected] = useState(false)
    const [showVectorSets, setShowVectorSets] = useState(false)
    const [statusMessage, setStatusMessage] = useState("")
    const [isInitializing, setIsInitializing] = useState(true)
    const [_state, setState] = useState<StoredConnectionState>({
        redisUrl: "",
        showVectorSets: true,
    })

    // Combined initialization effect
    useEffect(() => {
        let mounted = true

        const initialize = async () => {
            try {
                // Skip auto-restoration if we're on the vectorset page
                if (
                    typeof window !== "undefined" &&
                    window.location.pathname.includes("/vectorset")
                ) {
                    setIsInitializing(false)
                    return
                }

                // First load stored state
                const storedState =
                    userSettings.get<StoredConnectionState>(STORAGE_KEY)
                if (!mounted) return

                if (storedState) {
                    setRedisUrl(storedState.redisUrl)
                    setShowVectorSets(storedState.showVectorSets)

                    // Check connection with stored URL
                    const response = await fetch("/api/redis", {
                        method: "GET",
                    })
                    const data = await response.json()

                    if (!mounted) return

                    if (response.ok && data.success) {
                        setIsConnected(true)
                        setShowVectorSets(true)
                        setStatusMessage("Connected")
                    } else {
                        // Attempt to reconnect with stored URL
                        try {
                            await handleConnect(storedState.redisUrl)
                        } catch (error) {
                            console.error("Failed to reconnect:", error)
                            clearState()
                            setIsConnected(false)
                            setShowVectorSets(false)
                        }
                    }
                }
            } catch (error) {
                console.error("Error during initialization:", error)
                clearState()
                setIsConnected(false)
                setShowVectorSets(false)
            } finally {
                if (mounted) {
                    setIsInitializing(false)
                }
            }
        }

        initialize()

        return () => {
            mounted = false
        }
    }, []) // Empty dependency array since this should only run once on mount

    const handleConnect = useCallback(async (url: string): Promise<boolean> => {
        setStatusMessage("Connecting...")
        try {
            const response = await fetch("/api/redis/connect", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ url }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Failed to connect")
            }

            setRedisUrl(url)
            setIsConnected(true)
            setShowVectorSets(true)
            setStatusMessage("Connected successfully")

            // Persist UI state
            setState({
                redisUrl: url,
                showVectorSets: true,
            })

            return true
        } catch (error) {
            console.error("Error connecting to Redis:", error)
            setIsConnected(false)
            setStatusMessage(
                error instanceof Error ? error.message : "Failed to connect"
            )
            return false
        }
    }, [])

    const disconnect = useCallback(async () => {
        try {
            await fetch("/api/redis/connect", { method: "DELETE" })
            setIsConnected(false)
            setShowVectorSets(false)
            setStatusMessage("")
            setRedisUrl(null)

            // Clear persisted state
            clearState()
        } catch (error) {
            console.error("Error disconnecting from Redis:", error)
            setStatusMessage("Failed to disconnect")
            throw error
        }
    }, [])

    const updateState = useCallback(
        async (newState: Partial<StoredConnectionState>) => {
            setState((prev) => {
                const updated = { ...prev, ...newState }
                try {
                    userSettings.set(STORAGE_KEY, updated)
                } catch (error) {
                    console.error("Error updating Redis connection state:", error)
                }
                return updated
            })
        },
        []
    )

    const clearState = useCallback(async () => {
        setState({
            redisUrl: "",
            showVectorSets: true,
        })
        userSettings.delete(STORAGE_KEY)
    }, [])

    return {
        redisUrl,
        isConnected,
        showVectorSets,
        statusMessage,
        handleConnect,
        setRedisUrl,
        setShowVectorSets,
        disconnect,
        isInitializing,
        updateState,
        clearState,
    }
}

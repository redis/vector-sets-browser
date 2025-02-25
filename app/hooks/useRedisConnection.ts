import { useState, useEffect, useCallback } from "react"

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
}

const STORAGE_KEY = 'redisConnection'

interface StoredConnectionState {
    redisUrl: string
    showVectorSets: boolean
}

// Safe localStorage access that works on both client and server
const getStoredState = (): StoredConnectionState | null => {
    if (typeof window === 'undefined') return null;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    try {
        return stored ? JSON.parse(stored) : null;
    } catch (error) {
        console.error('Error parsing stored state:', error);
        return null;
    }
}

const persistConnectionState = (state: StoredConnectionState): void => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
        console.error('Error persisting state:', error);
    }
}

const clearStoredState = (): void => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.error('Error clearing stored state:', error);
    }
}

export function useRedisConnection(initialUrl?: string): UseRedisConnectionReturn {
    const [redisUrl, setRedisUrl] = useState<string | null>(initialUrl || null)
    const [isConnected, setIsConnected] = useState(false)
    const [showVectorSets, setShowVectorSets] = useState(false)
    const [statusMessage, setStatusMessage] = useState("")
    const [isInitializing, setIsInitializing] = useState(true)

    // Combined initialization effect
    useEffect(() => {
        let mounted = true
        
        const initialize = async () => {
            try {
                // Skip auto-restoration if we're on the vectorset page
                if (typeof window !== 'undefined' && window.location.pathname.includes('/vectorset')) {
                    setIsInitializing(false)
                    return
                }

                // First load stored state
                const storedState = getStoredState()
                if (!mounted) return

                if (storedState) {
                    setRedisUrl(storedState.redisUrl)
                    setShowVectorSets(storedState.showVectorSets)
                    
                    // Check connection with stored URL
                    const response = await fetch('/api/redis', {
                        method: 'GET'
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
                            clearStoredState()
                            setIsConnected(false)
                            setShowVectorSets(false)
                        }
                    }
                }
            } catch (error) {
                console.error("Error during initialization:", error)
                clearStoredState()
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
            const response = await fetch('/api/redis/connect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url }),
            })

            const data = await response.json()
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to connect')
            }

            setRedisUrl(url)
            setIsConnected(true)
            setShowVectorSets(true)
            setStatusMessage("Connected successfully")
            
            // Persist UI state
            persistConnectionState({
                redisUrl: url,
                showVectorSets: true
            })

            return true
        } catch (error) {
            console.error("Error connecting to Redis:", error)
            setIsConnected(false)
            setStatusMessage(error instanceof Error ? error.message : "Failed to connect")
            return false
        }
    }, [])

    const disconnect = useCallback(async () => {
        try {
            await fetch('/api/redis/connect', { method: 'DELETE' })
            setIsConnected(false)
            setShowVectorSets(false)
            setStatusMessage("")
            setRedisUrl(null)
            
            // Clear persisted state
            clearStoredState();
        } catch (error) {
            console.error("Error disconnecting from Redis:", error)
            setStatusMessage("Failed to disconnect")
            throw error
        }
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
        isInitializing
    }
} 
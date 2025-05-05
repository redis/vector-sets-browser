"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRouter, useSearchParams } from "next/navigation"
import React, { Suspense, useEffect, useState, useMemo } from "react"
import { useRedisConnection } from "../../hooks/useRedisConnection"
import { useVectorSet } from "./hooks/useVectorSet"
import { getConnection, removeConnection } from "@/lib/redis-server/connectionManager"
import { userSettings } from "@/lib/storage/userSettings"
import AddVectorModal from "./components/AddVectorDialog"
import ImportTab from "./components/ImportTab/ImportTab"
import InfoPanel from "./components/InfoTab/InfoPanel"
import VectorSearchTab from "./components/SearchTab/VectorSearchTab"
import VectorSetHeader from "./components/VectorSetHeader"
import VectorSetNav from "./components/VectorSetNav"
import VectorSettings from "./components/SettingsTab/VectorSettings"

// Memoize the header component to prevent unnecessary re-renders
const MemoizedVectorSetHeader = React.memo(VectorSetHeader);

// Memoize the navigation component
const MemoizedVectorSetNav = React.memo(VectorSetNav);

/**
 * VectorSetPage handles the display and management of vector sets.
 * Connection Flow:
 * 1. Check for connection ID in URL params
 * 2. Retrieve connection details from session storage
 * 3. Attempt to restore connection using stored URL
 * 4. Verify connection is active
 * 5. Only render content when connection is confirmed
 *
 * Error Handling:
 * - No connection ID -> redirect to /home
 * - Invalid/expired connection -> redirect to /home
 * - Connection failure -> redirect to /home
 * - Connection verification failure -> redirect to /home
 */

export default function VectorSetPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center w-full h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
        }>
            <VectorSetPageContent />
        </Suspense>
    )
}

function VectorSetPageContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const connectionId = searchParams.get("cid")
    const [isRestoring, setIsRestoring] = useState(true)
    const [redisName, setRedisName] = useState<string | null>(null)
    const [isAddVectorModalOpen, setIsAddVectorModalOpen] = useState(false)
    const [activeTab, setActiveTab] = useState("search")
    // Keep track of search state per vector set
    const [isVectorSetChanging, setIsVectorSetChanging] = useState(false)
    // Add state to track if we should auto-open sample data dialog

    // Function to change active tab - can be passed to child components
    const changeTab = (tabName: string) => {
        setActiveTab(tabName);
    }

    const {
        redisUrl,
        isConnected,
        handleConnect,
        disconnect,
        isInitializing,
        setRedisUrl,
    } = useRedisConnection()

    const {
        vectorSetName,
        setVectorSetName,
        dim,
        recordCount,
        metadata,
        handleAddVector,
        handleDeleteVector,
        handleDeleteVector_multi,
        handleShowVector,
        results,
        setResults,
        updateMetadata,
    } = useVectorSet()

    const handleDisconnect = () => {
        if (connectionId) {
            removeConnection(connectionId)
        }
        disconnect()
        router.push("/console")
    }

    // If no connection ID is present, redirect to home
    useEffect(() => {
        const restoreConnection = async () => {
            if (!connectionId) {
                console.error("No connection ID found")
                router.push("/console")
                return
            }

            try {
                setIsRestoring(true)
                // Get connection details from session storage
                const connection = getConnection(connectionId)
                if (!connection) {
                    // Invalid or expired connection ID
                    console.error("Invalid or expired connection ID")
                    router.push("/console")
                    return
                }

                // Try to get the friendly name from settings
                try {
                    const savedConnections = userSettings.get(
                        "recentRedisConnections"
                    )
                    if (savedConnections) {
                        const connections = JSON.parse(savedConnections)
                        const matchingConnection = connections.find(
                            (conn: {
                                id: string
                                host: string
                                port: string
                                name: string
                            }) =>
                                conn.id === connection.url ||
                                `redis://${conn.host}:${conn.port}` ===
                                connection.url
                        )
                        if (matchingConnection) {
                            setRedisName(matchingConnection.name)
                        }
                    }
                } catch (e) {
                    console.error("Error getting Redis name:", e)
                }

                // Connect using the stored URL
                const success = await handleConnect(connection.url)
                if (!success) {
                    console.error("Failed to restore connection")
                    router.push("/console")
                    return
                }

                // Verify connection is active
                const response = await fetch("/api/redis", {
                    method: "GET",
                })
                const data = await response.json()

                if (!response.ok || !data.success) {
                    console.error(
                        "Connection verification failed:",
                        data.error || "No active connection"
                    )
                    router.push("/console")
                    return
                }

                setIsRestoring(false)
            } catch (error) {
                console.error("Error restoring connection:", error)
                router.push("/console")
            }
        }

        restoreConnection()
    }, [connectionId, router, handleConnect])

    const handleVectorSetChange = (newVectorSet: string | null) => {
        setIsVectorSetChanging(true)
        setVectorSetName(newVectorSet)
        setTimeout(() => setIsVectorSetChanging(false), 100)
    }

    // Memoize loading and connection states to prevent unnecessary rerenders
    const loadingState = useMemo(() => {
        if (isInitializing || isRestoring) {
            return (
                <div className="flex items-center justify-center w-full h-screen">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
            );
        }
        
        if (!isConnected) {
            return (
                <div className="flex items-center justify-center w-full h-screen">
                    <div className="text-gray-500">Connecting to Redis...</div>
                </div>
            );
        }
        
        return null;
    }, [isInitializing, isRestoring, isConnected]);

    // Memoize search tab content to prevent unnecessary rerenders
    const searchTabContent = useMemo(() => {
        if (isVectorSetChanging || !vectorSetName) return null;
        
        return (
            <VectorSearchTab
                vectorSetName={vectorSetName}
                dim={dim}
                metadata={metadata}
                onAddVector={() => setIsAddVectorModalOpen(true)}
                onShowVector={handleShowVector}
                onDeleteVector={handleDeleteVector}
                onDeleteVector_multi={handleDeleteVector_multi}
                isLoading={isVectorSetChanging}
                results={results}
                setResults={setResults}
                changeTab={changeTab}
            />
        );
    }, [
        isVectorSetChanging,
        vectorSetName,
        dim,
        metadata,
        handleShowVector,
        handleDeleteVector,
        handleDeleteVector_multi,
        results,
        setResults,
        changeTab
    ]);

    // If in loading state, return the loading UI
    if (loadingState) {
        return loadingState;
    }

    return (
        <div className="flex flex-1 h-screen">
            <MemoizedVectorSetNav
                redisUrl={redisUrl}
                redisName={redisName}
                selectedVectorSet={vectorSetName}
                onVectorSetSelect={handleVectorSetChange}
                onRedisUrlChange={setRedisUrl}
                onConnect={handleConnect}
                isConnected={isConnected}
                onBack={handleDisconnect}
            />

            <div className="flex-1 p-4 overflow-y-auto flex flex-col">
                {vectorSetName ? (
                    <div className="mb-4 border-b border-gray-500">
                        <MemoizedVectorSetHeader
                            vectorSetName={vectorSetName}
                            recordCount={recordCount}
                            dim={dim}
                            metadata={metadata}
                        />
                    </div>
                ) : (
                    <div className="text-center py-12 text-gray-500">
                        No vector sets, create a new vector set to get started
                    </div>
                )}
                {vectorSetName ? (
                    <Tabs
                        defaultValue="search"
                        className="w-full h-full flex flex-col"
                        value={activeTab}
                        onValueChange={(value) => {
                            setActiveTab(value)
                        }}
                    >
                        <TabsList className="bg-gray-200 w-full">
                            <TabsTrigger className="w-full" value="search">
                                Search / Explore
                            </TabsTrigger>
                            <TabsTrigger className="w-full" value="info">
                                Information
                            </TabsTrigger>
                            <TabsTrigger className="w-full" value="settings">
                                Configuration
                            </TabsTrigger>
                            <TabsTrigger className="w-full" value="import">
                                Import Data
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="info">
                            <InfoPanel
                                vectorSetName={vectorSetName}
                                dim={dim}
                                metadata={metadata}
                            />
                        </TabsContent>

                        <TabsContent value="settings">
                            <VectorSettings
                                vectorSetName={vectorSetName}
                                metadata={metadata}
                                onMetadataUpdate={updateMetadata}
                            />
                        </TabsContent>

                        <TabsContent value="import">
                            <ImportTab
                                vectorSetName={vectorSetName}
                                metadata={metadata}
                            />
                        </TabsContent>

                        <TabsContent value="search">
                            {searchTabContent}
                        </TabsContent>
                    </Tabs>
                ) : (
                    <div>
                    </div>
                )}

                {isAddVectorModalOpen && (
                    <AddVectorModal
                        isOpen={isAddVectorModalOpen}
                        onClose={() => setIsAddVectorModalOpen(false)}
                        onAdd={handleAddVector}
                        metadata={metadata}
                        dim={dim}
                        vectorSetName={vectorSetName}
                    />
                )}

            </div>
        </div>
    )
}

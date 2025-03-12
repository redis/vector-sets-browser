"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import VectorSetNav from "../components/VectorSetNav"
import AddVectorModal from "../components/AddVectorModal"
import EditEmbeddingConfigModal from "../components/EditEmbeddingConfigModal"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import InfoPanel from "../components/InfoPanel"
import VectorSetHeader from "../components/VectorSetHeader"
import { useRedisConnection } from "../hooks/useRedisConnection"
import { useVectorSet } from "../hooks/useVectorSet"
import { useFileOperations } from "../hooks/useFileOperations"
import ImportTab from "../components/ImportTab"
import { getConnection, removeConnection } from "../lib/connectionManager"
import { EmbeddingConfig, VectorSetMetadata } from "../types/embedding"
import VectorSetVisualization from "../components/VectorSetVisualization"
import VectorSearchTab from "../components/VectorSearchTab"
import { VectorSetSearchState } from "../hooks/useVectorSearch"

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

// Default search state
const DEFAULT_SEARCH_STATE: VectorSetSearchState = {
    searchType: "Vector",
    searchQuery: "",
    searchCount: "10",
    resultsTitle: "Search Results",
    searchFilter: "",
}

export default function VectorSetPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const connectionId = searchParams.get("cid")
    const [isRestoring, setIsRestoring] = useState(true)
    const [redisName, setRedisName] = useState<string | null>(null)
    const [isAddVectorModalOpen, setIsAddVectorModalOpen] = useState(false)
    const [isEditConfigModalOpen, setIsEditConfigModalOpen] = useState(false)
    const [activeTab, setActiveTab] = useState("search")
    // Keep track of search state per vector set
    const [vectorSetSearchStates, setVectorSetSearchStates] = useState<Record<string, VectorSetSearchState>>({})
    const [isVectorSetChanging, setIsVectorSetChanging] = useState(false)

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
        handleShowVector,
        results,
        setResults
    } = useVectorSet()

    // Update search state for current vector set
    const handleSearchStateChange = (searchState: VectorSetSearchState) => {
        if (!vectorSetName) return
        setVectorSetSearchStates(prev => ({
            ...prev,
            [vectorSetName]: searchState
        }))
    }

    // Get the current vector set's search state
    const currentSearchState = vectorSetName ? (
        vectorSetSearchStates[vectorSetName] || DEFAULT_SEARCH_STATE
    ) : null

    const { handleSaveConfig } = useFileOperations({
        vectorSetName,
        onModalClose: () => {}, // No need to reload since we're not managing results here anymore
        onStatusChange: (status) => console.log(status),
    })

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

                // Try to get the friendly name from localStorage
                try {
                    const savedConnections = localStorage.getItem(
                        "recentRedisConnections"
                    )
                    if (savedConnections) {
                        const connections = JSON.parse(savedConnections)
                        const matchingConnection = connections.find(
                            (conn: any) =>
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

    const handleEditConfig = async (newConfig: EmbeddingConfig) => {
        try {
            if (!vectorSetName) {
                throw new Error("No vector set selected")
            }

            // Create the new metadata object, preserving other metadata fields
            const updatedMetadata: VectorSetMetadata = {
                ...metadata,
                embedding: newConfig,
                created: metadata?.created || new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
            }

            await handleSaveConfig(vectorSetName, updatedMetadata)
            setIsEditConfigModalOpen(false)
        } catch (error) {
            console.error("[VectorSetPage] Error saving config:", error)
        }
    }

    const handleVectorSetChange = (newVectorSet: string | null) => {
        setIsVectorSetChanging(true)
        setVectorSetName(newVectorSet)
        setTimeout(() => setIsVectorSetChanging(false), 100)
    }

    if (isInitializing || isRestoring) {
        return (
            <div className="flex items-center justify-center w-full h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
        )
    }

    // Don't render content until we're connected
    if (!isConnected) {
        return (
            <div className="flex items-center justify-center w-full h-screen">
                <div className="text-gray-500">Connecting to Redis...</div>
            </div>
        )
    }

    return (
        <div className="flex flex-1 h-screen">
            <VectorSetNav
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
                        <VectorSetHeader
                            vectorSetName={vectorSetName}
                            recordCount={recordCount}
                            dim={dim}
                            metadata={metadata}
                        />
                    </div>
                ) : (
                    <div></div>
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
                            <TabsTrigger className="w-full" value="visualize">
                                Visualize
                            </TabsTrigger>
                            <TabsTrigger className="w-full" value="info">
                                Information
                            </TabsTrigger>
                            <TabsTrigger className="w-full" value="import">
                                Import Data
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="info">
                            <InfoPanel
                                vectorSetName={vectorSetName}
                                recordCount={recordCount}
                                dim={dim}
                                metadata={metadata}
                                onEditConfig={() =>
                                    setIsEditConfigModalOpen(true)
                                }
                            />
                        </TabsContent>

                        <TabsContent value="import">
                            <ImportTab
                                vectorSetName={vectorSetName}
                                metadata={metadata}
                            />
                        </TabsContent>

                        <TabsContent value="search">
                            {!isVectorSetChanging && (
                            <VectorSearchTab
                                vectorSetName={vectorSetName}
                                dim={dim}
                                metadata={metadata}
                                onAddVector={() => setIsAddVectorModalOpen(true)}
                                onShowVector={handleShowVector}
                                onDeleteVector={handleDeleteVector}
                                    isLoading={isVectorSetChanging}
                                    results={results}
                                    setResults={setResults}
                                />
                            )}
                        </TabsContent>

                        <TabsContent value="visualize">
                            {!isVectorSetChanging && (
                                <VectorSetVisualization 
                                    vectorSetName={vectorSetName}
                                    dim={dim || 0}
                                    metadata={metadata}
                                    searchState={currentSearchState}
                                    onSearchStateChange={handleSearchStateChange}
                                />
                            )}
                        </TabsContent>
                    </Tabs>
                ) : (
                    <div className="text-center py-12 text-gray-500">
                        Select a vector set from the left navigation to begin
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

                <EditEmbeddingConfigModal
                    isOpen={isEditConfigModalOpen}
                    onClose={() => setIsEditConfigModalOpen(false)}
                    config={metadata?.embedding}
                    onSave={handleEditConfig}
                />
            </div>
        </div>
    )
}

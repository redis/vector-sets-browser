"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import VectorSetNav from "../components/VectorSetNav"
import AddVectorModal from "../components/AddVectorModal"
import EditEmbeddingConfigModal from "../components/EditEmbeddingConfigModal"
import SearchBox from "../components/SearchBox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import InfoPanel from "../components/InfoPanel"
import VectorResults from "../components/VectorResults"
import StatusMessage from "../components/StatusMessage"
import VectorSetHeader from "../components/VectorSetHeader"
import { useRedisConnection } from "../hooks/useRedisConnection"
import { useVectorSet } from "../hooks/useVectorSet"
import { useVectorSearch, VectorSetSearchState } from "../hooks/useVectorSearch"
import { useFileOperations } from "../hooks/useFileOperations"
import { Button } from "@/components/ui/button"
import ImportTab from "../components/ImportTab"
import { getConnection, removeConnection } from "../lib/connectionManager"
import { EmbeddingConfig, VectorSetMetadata } from "../types/embedding"
import { Input } from "@/components/ui/input"
import SearchTimeIndicator from "../components/SearchTimeIndicator"
import HNSWVisualizer from "../components/HNSWVisualizer"

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
    const router = useRouter()
    const searchParams = useSearchParams()
    const connectionId = searchParams.get("cid")
    const [isRestoring, setIsRestoring] = useState(true)

    // Combined state for each vector set's data
    const [vectorSetStates, setVectorSetStates] = useState<
        Record<
            string,
            {
                searchState: VectorSetSearchState
                results: [string, number, number[]][]
            }
        >
    >({})

    const [fileOperationStatus, setFileOperationStatus] = useState("")

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
        statusMessage: vectorSetStatus,
        results,
        setResults,
        loadVectorSet: originalLoadVectorSet,
        handleAddVector,
        handleDeleteVector,
        handleShowVector,
        handleRowClick,
    } = useVectorSet()

    const [isAddVectorModalOpen, setIsAddVectorModalOpen] = useState(false)
    const [isEditConfigModalOpen, setIsEditConfigModalOpen] = useState(false)
    const [activeTab, setActiveTab] = useState("search")

    const {
        searchType,
        setSearchType,
        searchQuery,
        setSearchQuery,
        searchCount,
        setSearchCount,
        resultsTitle,
        setResultsTitle,
    } = useVectorSearch({
        vectorSetName,
        metadata,
        onSearchResults: (newResults) => {
            if (!vectorSetName) return
            setResults(newResults)

            // Cache the results
            setVectorSetStates((prev) => ({
                ...prev,
                [vectorSetName]: {
                    ...prev[vectorSetName],
                    results: newResults,
                    searchState: {
                        ...(prev[vectorSetName]?.searchState || {}),
                        searchType,
                        searchQuery,
                        searchCount,
                        resultsTitle,
                        activeTab,
                    },
                },
            }))
        },
        onStatusChange: (status) => {
            setFileOperationStatus(status)
        },
        searchState: vectorSetStates[vectorSetName || ""]?.searchState || {
            searchType: "Vector",
            searchQuery: "",
            searchCount: "10",
            resultsTitle: "Search Results",
            activeTab: "search",
        },
        onSearchStateChange: (newState) => {
            if (!vectorSetName) return
            setVectorSetStates((prev) => ({
                ...prev,
                [vectorSetName]: {
                    ...(prev[vectorSetName] || {
                        results: [],
                        searchState: {
                            searchType: "Vector",
                            searchQuery: "",
                            searchCount: "10",
                            resultsTitle: "Search Results",
                            activeTab: "search",
                        },
                    }),
                    searchState: {
                        ...(prev[vectorSetName]?.searchState || {}),
                        ...newState,
                    },
                },
            }))
        },
    })

    const handleVectorSelect = (element: string) => {
        console.log("[VectorSetPage] handleVectorSelect:", element)

        setSearchType("Element")        
        setSearchQuery(element)

    }

    // Initialize or restore vector set state when switching sets
    useEffect(() => {
        if (!vectorSetName) return

        const currentState = vectorSetStates[vectorSetName]
        if (currentState) {
            // Restore cached state
            setResults(currentState.results)

            // Restore search state
            if (currentState.searchState) {
                setSearchType(currentState.searchState.searchType)
                setSearchQuery(currentState.searchState.searchQuery)
                setSearchCount(currentState.searchState.searchCount)
                setResultsTitle(currentState.searchState.resultsTitle)
                setActiveTab(currentState.searchState.activeTab || "search")
            }
        }
    }, [vectorSetName])

    // Cache results and search state when they change
    useEffect(() => {
        if (vectorSetName) {
            setVectorSetStates((prev) => ({
                ...prev,
                [vectorSetName]: {
                    ...(prev[vectorSetName] || {}),
                    results,
                    searchState: {
                        ...(prev[vectorSetName]?.searchState || {}),
                        searchType,
                        searchQuery,
                        searchCount,
                        resultsTitle,
                        activeTab,
                    },
                },
            }))
        }
    }, [
        vectorSetName,
        results,
        searchType,
        searchQuery,
        searchCount,
        resultsTitle,
        activeTab,
    ])

    // Simplified loadVectorSet that works with the new state structure
    const loadVectorSet = async () => {
        if (!vectorSetName) return null
        await originalLoadVectorSet()
    }

    const { handleSaveConfig } = useFileOperations({
        vectorSetName,
        onStatusChange: setFileOperationStatus,
        onModalClose: loadVectorSet,
    })

    // Event handler wrappers for vector operations
    const handleDeleteClick = (e: React.MouseEvent, element: string) => {
        e.stopPropagation()
        handleDeleteVector(element)
    }

    const handleShowVectorClick = (e: React.MouseEvent, element: string) => {
        e.stopPropagation()
        handleShowVector(element)
    }

    // Wrapper for handleRowClick to store the search time
    const handleRowClickWrapper = async (element: string) => {
        const duration = await handleRowClick(element)
        if (vectorSetName && duration) {
            // Store the search time in the state
            setVectorSetStates((prev) => ({
                ...prev,
                [vectorSetName]: {
                    ...(prev[vectorSetName] || {}),
                    searchState: {
                        ...(prev[vectorSetName]?.searchState || {}),
                        searchTime: duration,
                    },
                },
            }))
        }
    }

    const handleDisconnect = () => {
        if (connectionId) {
            removeConnection(connectionId)
        }
        disconnect()
        router.push("/home")
    }

    // If no connection ID is present, redirect to home
    useEffect(() => {
        const restoreConnection = async () => {
            if (!connectionId) {
                console.error("No connection ID found")
                router.push("/home")
                return
            }

            try {
                setIsRestoring(true)
                // Get connection details from session storage
                const connection = getConnection(connectionId)
                if (!connection) {
                    // Invalid or expired connection ID
                    console.error("Invalid or expired connection ID")
                    router.push("/home")
                    return
                }

                // Connect using the stored URL
                const success = await handleConnect(connection.url)
                if (!success) {
                    console.error("Failed to restore connection")
                    router.push("/home")
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
                    router.push("/home")
                    return
                }

                setIsRestoring(false)
            } catch (error) {
                console.error("Error restoring connection:", error)
                router.push("/home")
            }
        }

        restoreConnection()
    }, [connectionId, router, handleConnect])

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

    const handleEditConfig = async (newConfig: EmbeddingConfig) => {
        try {
            setFileOperationStatus("Saving configuration...")
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

            console.log("[VectorSetPage] Saving new config:", newConfig)
            await handleSaveConfig(vectorSetName, updatedMetadata)
            console.log("[VectorSetPage] Config saved, reloading vector set")
            await loadVectorSet() // Reload the vector set to get updated metadata
            setFileOperationStatus("Configuration saved successfully")
            setIsEditConfigModalOpen(false)
        } catch (error) {
            console.error("[VectorSetPage] Error saving config:", error)
            setFileOperationStatus(
                error instanceof Error
                    ? error.message
                    : "Failed to save configuration"
            )
        }
    }

    return (
        <div className="flex flex-1 h-screen">
            <VectorSetNav
                redisUrl={redisUrl}
                selectedVectorSet={vectorSetName}
                onVectorSetSelect={setVectorSetName}
                onRedisUrlChange={setRedisUrl}
                onConnect={handleConnect}
                isConnected={isConnected}
                onBack={handleDisconnect}
            />

            <div className="flex-1 p-4 overflow-y-auto">
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
                        className="w-full"
                        onValueChange={setActiveTab}
                    >
                        <TabsList className="bg-gray-200 p-0 w-full">
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
                            <SearchBox
                                searchType={searchType}
                                setSearchType={setSearchType}
                                searchQuery={searchQuery}
                                setSearchQuery={setSearchQuery}
                                dim={dim}
                                metadata={metadata}
                            />
                            <section>
                                <div className="bg-white p-4 rounded shadow-md">
                                    <div className="flex mb-4 items-center space-x-2">
                                        <div className="flex items-center gap-2 justify-between w-full">
                                            <div className="flex items-center gap-2">
                                                <span className="whitespace-nowrap">
                                                    Top
                                                </span>
                                                <Input
                                                    type="number"
                                                    value={searchCount}
                                                    onChange={(e) =>
                                                        setSearchCount(
                                                            e.target.value
                                                        )
                                                    }
                                                    className="border rounded p-1 w-16 h-8 text-center"
                                                    min="1"
                                                />
                                            </div>
                                            <StatusMessage
                                                message={
                                                    fileOperationStatus ||
                                                    vectorSetStatus
                                                }
                                            />
                                            {vectorSetStates[
                                                vectorSetName || ""
                                            ]?.searchState?.searchTime && (
                                                <SearchTimeIndicator
                                                    searchTime={
                                                        vectorSetStates[
                                                            vectorSetName || ""
                                                        ]?.searchState?.searchTime
                                                        ? Number(vectorSetStates[
                                                            vectorSetName || ""
                                                        ]?.searchState?.searchTime)
                                                        : undefined
                                                    }
                                                />
                                            )}
                                        </div>
                                        {/* <Button
                                            onClick={loadVectorSet}
                                            title="Refresh results"
                                            variant="ghost"
                                        >
                                            <svg
                                                className="w-6 h-6"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                                />
                                            </svg>
                                        </Button> */}
                                        <Button
                                            variant="default"
                                            onClick={() =>
                                                setIsAddVectorModalOpen(true)
                                            }
                                        >
                                            <svg
                                                className="w-5 h-5"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M12 4v16m8-8H4"
                                                />
                                            </svg>
                                            Add
                                        </Button>
                                    </div>
                                    <VectorResults
                                        results={results}
                                        onRowClick={handleRowClickWrapper}
                                        onDeleteClick={handleDeleteClick}
                                        onShowVectorClick={
                                            handleShowVectorClick
                                        }
                                        searchTime={
                                            vectorSetStates[vectorSetName || ""]
                                                ?.searchState?.searchTime
                                        }
                                    />
                                </div>
                            </section>
                        </TabsContent>

                        <TabsContent value="visualize">
                            <SearchBox
                                searchType={searchType}
                                setSearchType={setSearchType}
                                searchQuery={searchQuery}
                                setSearchQuery={setSearchQuery}
                                dim={dim}
                                metadata={metadata}
                            />
                            <div className="mt-8">
                                <div className="bg-white p-4 rounded shadow-md">
                                    <div className="flex mb-4 items-center">
                                        <div className="flex items-center gap-4 w-full">
                                            <div>Visualization</div>
                                            <div className="grow"></div>
                                            <StatusMessage
                                                message={
                                                    fileOperationStatus ||
                                                    vectorSetStatus
                                                }
                                            />
                                        </div>
                                    </div>
                                    {vectorSetStates[vectorSetName || ""]
                                        ?.searchState?.searchTime && (
                                        <div className="text-sm text-gray-500 mb-4">
                                            Search completed in{" "}
                                            <SearchTimeIndicator
                                                searchTime={
                                                    vectorSetStates[
                                                        vectorSetName || ""
                                                    ]?.searchState?.searchTime
                                                    ? Number(vectorSetStates[
                                                        vectorSetName || ""
                                                    ]?.searchState?.searchTime)
                                                    : undefined
                                                }
                                            />
                                        </div>
                                    )}
                                    <div style={{ height: "600px" }}>
                                        <HNSWVisualizer
                                            keyName={vectorSetName || ""}
                                            initialElement={results.length > 0 ? results[0][0] : vectorSetName}
                                            maxNodes={200}
                                            initialNodes={50}
                                        />
                                    </div>
                                </div>
                            </div>
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

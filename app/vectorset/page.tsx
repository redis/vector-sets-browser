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
import VectorSetHeader from "../components/VectorSetHeader"
import { useRedisConnection } from "../hooks/useRedisConnection"
import { useVectorSet } from "../hooks/useVectorSet"
import { useVectorSearch, VectorSetSearchState } from "../hooks/useVectorSearch"
import { useFileOperations } from "../hooks/useFileOperations"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import ImportTab from "../components/ImportTab"
import { getConnection, removeConnection } from "../lib/connectionManager"
import { EmbeddingConfig, VectorSetMetadata } from "../types/embedding"
import { Input } from "@/components/ui/input"
import SearchTimeIndicator from "../components/SearchTimeIndicator"
import HNSWVizPure from "../components/vizualizer/HNSWVizPure"
import VectorViz3D from "../components/VectorViz3D"
import * as redis from "../services/redis"
import { toast } from "sonner"
import StatusMessage from "../components/StatusMessage"
import VectorViz2D from "../components/VectorViz2D"
import type { SimilarityItem } from "../components/VectorViz2D"

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
    const [redisName, setRedisName] = useState<string | null>(null)
    const [vizType, setVizType] = useState<"2d" | "3d">("2d")

    // Combined state for each vector set's data
    const [vectorSetStates, setVectorSetStates] = useState<
        Record<
            string,
            {
                searchState: VectorSetSearchState
                results: [string, number, number[] | null][]
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
        isSearching,
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

    const [activeView, setActiveView] = useState<"Table" | "2D">("Table")

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

        if (confirm("Are you sure you want to delete this vector?")) {
            handleDeleteVector(element)
        }
    }

    const handleShowVectorClick = async (
        e: React.MouseEvent,
        element: string
    ) => {
        e.stopPropagation()
        try {
            // Get the vector either from results or Redis
            const vector = await handleShowVector(element)
            if (!vector) {
                toast.error("Error retrieving vector")
                return
            }

            // Copy vector to clipboard
            await navigator.clipboard.writeText(JSON.stringify(vector))
            toast.success("Vector copied to clipboard")
        } catch (error) {
            console.error("Error copying vector:", error)
            toast.error("Failed to copy vector to clipboard")
        }
    }

    // Wrapper for handleRowClick to store the search time
    const handleRowClick = async (element: string) => {
        setSearchType("Element")
        setSearchQuery(element)
    }

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

    const onExpandNode = async (
        keyName: string,
        element: string,
        mode: "NeighborExpansion" | "SimilarityArray",
        count: number
    ): Promise<SimilarityItem[]> => {
        console.log(
            "[VectorSetPage] Expanding node:",
            keyName,
            element,
            mode,
            count
        )
        try {
            switch (mode) {
                case "NeighborExpansion":
                    return await getNeighbors(keyName, element, count, true)
                case "SimilarityArray":
                    return await getSimilarity(keyName, element, count)
            }
        } catch (error) {
            console.error("Error expanding node:", error)
            return []
        }
    }

    const getNeighbors = async (
        keyName: string,
        element: string,
        count: number,
        withEmbeddings?: boolean
    ): Promise<SimilarityItem[]> => {
        try {
            const data = await redis.vlinks(
                keyName,
                element,
                count,
                withEmbeddings ?? false
            )
            console.log("[VectorSetPage] Neighbors:", data)
            // convert to SimilarityItem[]
            return data.map((item) => ({
                element: item[0],
                similarity: item[1],
                vector: item[2],
            }))
        } catch (error) {
            console.error("Error fetching neighbors:", error)
            return []
        }
    }

    // Callbacks for HNSWVizPure
    const getSimilarity = async (
        keyName: string,
        element: string,
        count: number,
        withEmbeddings?: boolean
    ): Promise<SimilarityItem[]> => {
        try {
            console.log(
                "[VectorSetPage] Getting neighbors for:",
                keyName,
                element,
                count
            )
            const data = await redis.vsim(
                keyName,
                element,
                count,
                withEmbeddings ?? false
            )
            console.log("[VectorSetPage] Neighbors:", data)
            return data.map((item) => ({
                element: item[0],
                similarity: item[1],
                vector: item[2],
            }))
        } catch (error) {
            console.error("Error fetching neighbors:", error)
            return []
        }
    }

    return (
        <div className="flex flex-1 h-screen">
            <VectorSetNav
                redisUrl={redisUrl}
                redisName={redisName}
                selectedVectorSet={vectorSetName}
                onVectorSetSelect={setVectorSetName}
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
                        onValueChange={setActiveTab}
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
                                        <div className="flex items-center gap-2 w-full">
                                            <div className="flex items-center gap-2">
                                                {/* <span className="text-xs whitespace-nowrap">
                                                    Show top
                                                </span> */}
                                                {!isSearching &&
                                                    results &&
                                                    results.length > 0 && (
                                                        <Input
                                                            type="number"
                                                            value={searchCount}
                                                            onChange={(e) =>
                                                                setSearchCount(
                                                                    e.target
                                                                        .value
                                                                )
                                                            }
                                                            className="border rounded p-1 w-16 h-8 text-center"
                                                            min="1"
                                                        />
                                                    )}

                                                <span className="flex text-gray-500 text-sm items-center space-x-2 whitespace-nowrap">
                                                    {!isSearching &&
                                                        results &&
                                                        results.length > 0 && (
                                                            <div>
                                                                results in
                                                            </div>
                                                        )}
                                                    <div>
                                                        {(vectorSetStates[
                                                            vectorSetName || ""
                                                        ]?.searchState
                                                            ?.searchTime ||
                                                            isSearching) && (
                                                            <SearchTimeIndicator
                                                                searchTime={
                                                                    vectorSetStates[
                                                                        vectorSetName ||
                                                                            ""
                                                                    ]
                                                                        ?.searchState
                                                                        ?.searchTime
                                                                        ? Number(
                                                                              vectorSetStates[
                                                                                  vectorSetName ||
                                                                                      ""
                                                                              ]
                                                                                  ?.searchState
                                                                                  ?.searchTime
                                                                          )
                                                                        : undefined
                                                                }
                                                                isSearching={
                                                                    isSearching
                                                                }
                                                            />
                                                        )}
                                                    </div>
                                                </span>
                                            </div>
                                            <StatusMessage
                                                message={
                                                    fileOperationStatus ||
                                                    vectorSetStatus
                                                }
                                            />
                                        </div>
                                        <div className="grow"></div>
                                        <div className="text-sm text-gray-500 whitespace-nowrap">
                                            Choose View
                                        </div>
                                        <div className="flex items-center gap-2 w-[300px]">
                                            <Select
                                                value={activeView}
                                                onValueChange={(
                                                    value: "Table" | "2D"
                                                ) => setActiveView(value)}
                                            >
                                                <SelectTrigger className="">
                                                    <SelectValue
                                                        placeholder={
                                                            "View as " +
                                                            activeView
                                                        }
                                                    />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Table">
                                                        Table
                                                    </SelectItem>
                                                    <SelectItem value="2D">
                                                        2D Vizualization
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
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
                                            Add Vector
                                        </Button>
                                    </div>
                                    {activeView === "Table" ? (
                                        <VectorResults
                                            results={results}
                                            onRowClick={handleRowClick}
                                            onDeleteClick={handleDeleteClick}
                                            onShowVectorClick={
                                                handleShowVectorClick
                                            }
                                            searchTime={
                                                vectorSetStates[
                                                    vectorSetName || ""
                                                ]?.searchState?.searchTime
                                            }
                                        />
                                    ) : (
                                        <div>
                                            {results.length}
                                            <VectorViz2D
                                                mode="SimilarityArray"
                                                keyName={vectorSetName || ""}
                                                initialItems={
                                                    results.map((result) => ({
                                                        element: result[0],
                                                        similarity: result[1],
                                                        vector: result[2],
                                                    }))
                                                }
                                                onExpandNode={onExpandNode}
                                            />
                                        </div>
                                    )}
                                </div>
                            </section>
                        </TabsContent>

                        <TabsContent value="visualize" className="h-full">
                            <SearchBox
                                searchType={searchType}
                                setSearchType={setSearchType}
                                searchQuery={searchQuery}
                                setSearchQuery={setSearchQuery}
                                dim={dim}
                                metadata={metadata}
                            />
                            <div className="bg-white rounded shadow-md h-[calc(100vh-300px)]">
                                <div className="p-4 rounded shadow-md flex-1 flex flex-col">
                                    <div className="flex mb-4 items-center">
                                        <div className="flex items-center gap-4 w-full">
                                            <div className="flex items-center gap-2">
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
                                                <span className="text-xs">
                                                    results
                                                </span>
                                            </div>
                                            {
                                                <StatusMessage
                                                    message={
                                                        fileOperationStatus ||
                                                        vectorSetStatus
                                                    }
                                                />
                                            }
                                            <div className="grow"></div>

                                            {(vectorSetStates[
                                                vectorSetName || ""
                                            ]?.searchState?.searchTime ||
                                                isSearching) && (
                                                <div className="text-sm text-gray-500 mb-4">
                                                    <div className="flex items-center gap-4">
                                                        <SearchTimeIndicator
                                                            searchTime={
                                                                vectorSetStates[
                                                                    vectorSetName ||
                                                                        ""
                                                                ]?.searchState
                                                                    ?.searchTime
                                                                    ? Number(
                                                                          vectorSetStates[
                                                                              vectorSetName ||
                                                                                  ""
                                                                          ]
                                                                              ?.searchState
                                                                              ?.searchTime
                                                                      )
                                                                    : undefined
                                                            }
                                                            isSearching={
                                                                isSearching
                                                            }
                                                        />
                                                        <Select
                                                            value={vizType}
                                                            onValueChange={(
                                                                value:
                                                                    | "2d"
                                                                    | "3d"
                                                            ) =>
                                                                setVizType(
                                                                    value
                                                                )
                                                            }
                                                        >
                                                            <SelectTrigger className="w-[100px]">
                                                                <SelectValue placeholder="Visualization" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="2d">
                                                                    2D View
                                                                </SelectItem>
                                                                <SelectItem value="3d">
                                                                    3D View
                                                                </SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div
                                        className="flex-grow flex-1 "
                                        style={{
                                            minHeight: "calc(100vh - 400px)",
                                        }}
                                    >
                                        {results[0] ? (
                                            vizType === "2d" ? (
                                                <HNSWVizPure
                                                    key={`${vectorSetName}-${searchCount}-${
                                                        results[0]?.[0] || ""
                                                    }`}
                                                    keyName={
                                                        vectorSetName || ""
                                                    }
                                                    initialElement={
                                                        results.length > 0
                                                            ? results[0][0]
                                                            : vectorSetName
                                                    }
                                                    maxNodes={500}
                                                    initialNodes={Number(
                                                        searchCount
                                                    )}
                                                    getNeighbors={getNeighbors}
                                                />
                                            ) : (
                                                <VectorViz3D
                                                    data={results.map(
                                                        ([
                                                            label,
                                                            score,
                                                            vector,
                                                        ]) => ({
                                                            label: `${label} (${score.toFixed(
                                                                3
                                                            )})`,
                                                            vector,
                                                        })
                                                    )}
                                                    onVectorSelect={
                                                        handleRowClick
                                                    }
                                                />
                                            )
                                        ) : (
                                            "No Results Found"
                                        )}
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

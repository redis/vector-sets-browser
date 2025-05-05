"use client"

import SearchBox from "@/components/SearchBox"
import {
    useVectorSearch
} from "@/app/vectorset/hooks/useVectorSearch"
import { VectorTuple, vlinks } from "@/lib/redis-server/api"
import { VectorSetMetadata, VectorSetSearchOptions } from "@/lib/types/vectors"
import { userSettings } from "@/lib/storage/userSettings"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCallback, useState } from "react"
import { toast } from "sonner"
import VectorResults from "./VectorResults"
// import VectorViz3D from "../VisualizationTab/VectorViz3D"
import HNSW2dViz from "../VisualizationTab/vizualizer/HNSW2dViz"

interface VectorSearchTabProps {
    vectorSetName: string
    dim: number | null
    metadata: VectorSetMetadata | null
    onAddVector: () => void
    onShowVector: (element: string) => Promise<number[] | null>
    onDeleteVector: (element: string) => Promise<void>
    onDeleteVector_multi: (elements: string[]) => Promise<void>
    isLoading: boolean
    results: VectorTuple[]
    setResults: (results: VectorTuple[]) => void
    changeTab: (tab: string, options?: { openSampleData?: boolean }) => void
}

export default function VectorSearchTab({
    vectorSetName,
    dim,
    metadata,
    onAddVector,
    onShowVector,
    onDeleteVector,
    onDeleteVector_multi,
    isLoading,
    results,
    setResults,
    changeTab,
}: VectorSearchTabProps) {
    // Initialize search options from userSettings
    const [activeResultsTab, setActiveResultsTab] = useState("table")

    // Initialize with basic search state - advanced options will be loaded from userSettings by useVectorSearch
    const [searchState, setSearchState] = useState<VectorSetSearchOptions>({
        searchType: "Vector" as const,
        searchQuery: "",
        searchCount: "10",
        searchFilter: "",
        resultsTitle: "Search Results",
        searchTime: undefined as string | undefined,
        searchExplorationFactor: undefined,
        filterExplorationFactor: undefined,
        forceLinearScan: false,
        noThread: false,
    })

    const handleSearchResults = useCallback(
        (newResults: VectorTuple[]) => {
            setResults(newResults)
        },
        [setResults]
    )

    const handleStatusChange = useCallback(() => { }, [])

    const handleSearchStateChange = useCallback(
        (newState: Partial<VectorSetSearchOptions>) => {
            setSearchState((prevState: VectorSetSearchOptions) => ({
                ...prevState,
                ...newState,
            }))
        },
        []
    )

    const handleError = useCallback((error: string | null) => {
        if (error == null) return

        console.error("Search error: ", error)
    }, [])

    const {
        searchType,
        setSearchType,
        searchQuery,
        setSearchQuery,
        searchCount,
        setSearchCount,
        isSearching,
        searchTime,
        searchFilter,
        setSearchFilter,
        error,
        clearError: hookClearError,
        searchExplorationFactor,
        setSearchExplorationFactor,
        filterExplorationFactor,
        setFilterExplorationFactor,
        forceLinearScan,
        setForceLinearScan,
        noThread,
        setNoThread,
        executedCommand,
    } = useVectorSearch({
        vectorSetName,
        metadata,
        onSearchResults: handleSearchResults,
        onStatusChange: handleStatusChange,
        onError: handleError,
        searchState,
        onSearchStateChange: handleSearchStateChange,
        fetchEmbeddings: false, // Always fetch embeddings for visualization
    })

    const clearError = useCallback(() => {
        if (error && hookClearError) {
            hookClearError();
        }
    }, [error, hookClearError]);

    const handleSearchQueryChange = (query: string) => {
        setSearchQuery(query)
    }

    const handleRowClick = async (element: string) => {
        setSearchType("Element")
        setSearchQuery(element)
    }
    const handleBulkDeleteClick = (elements: string[]) => {
        if (confirm("Are you sure you want to delete these vectors?")) {
            console.log("Deleting vectors:", elements)
            onDeleteVector_multi(elements)
        }
    }
    const handleDeleteClick = (e: React.MouseEvent, element: string) => {
        e.stopPropagation()
        if (confirm("Are you sure you want to delete this vector?")) {
            onDeleteVector(element)
        }
    }

    const handleShowVectorClick = async (
        e: React.MouseEvent,
        element: string
    ) => {
        e.stopPropagation()
        try {
            const vector = await onShowVector(element)
            if (!vector) {
                toast.error("Error retrieving vector")
                return
            }

            await navigator.clipboard.writeText(JSON.stringify(vector))
            toast.success("Vector copied to clipboard")
        } catch (error) {
            console.error("Error copying vector:", error)
            toast.error("Failed to copy vector to clipboard")
        }
    }

    const getNeighbors = async (
        element: string,
        count: number,
    ): Promise<{ element: string; similarity: number; vector: number[] }[]> => {
        try {
            const response = await vlinks({
                keyName: vectorSetName,
                element,
                count,
                withEmbeddings: true, // Always fetch embeddings
            })
            console.log("vlink DATA", response)
            if (!response || !response.result) return []

            // data is an array of arrays
            // each inner array contains [element, similarity, vector]
            return response.result.flat().map((item) => ({
                element: item[0],
                similarity: item[1],
                vector: item[2] || [],
            }))
        } catch (error) {
            console.error("Error fetching neighbors:", error)
            return []
        }
    }

    return (
        <section>
            <SearchBox
                vectorSetName={vectorSetName}
                searchType={searchType}
                setSearchType={setSearchType}
                searchQuery={searchQuery}
                setSearchQuery={handleSearchQueryChange}
                searchFilter={searchFilter}
                setSearchFilter={setSearchFilter}
                searchCount={searchCount}
                setSearchCount={setSearchCount}
                dim={dim}
                metadata={metadata}
                error={error}
                searchExplorationFactor={searchExplorationFactor}
                setSearchExplorationFactor={setSearchExplorationFactor}
                filterExplorationFactor={filterExplorationFactor}
                setFilterExplorationFactor={setFilterExplorationFactor}
                forceLinearScan={forceLinearScan}
                setForceLinearScan={setForceLinearScan}
                noThread={noThread}
                setNoThread={setNoThread}
                executedCommand={executedCommand}
                results={results}
            />
            <div className="bg-[white] p-4 rounded shadow-md">
                <Tabs
                    value={activeResultsTab}
                    onValueChange={setActiveResultsTab}
                    className="w-full"
                >
                    <TabsList className="mb-4 w-full">
                        <TabsTrigger value="table" className="w-full">
                            Results Table
                        </TabsTrigger>
                        <TabsTrigger value="2d" className="w-full">
                            2D Visualization
                        </TabsTrigger>
                        {/* <TabsTrigger value="3d" className="w-full">3D Visualization</TabsTrigger> */}
                    </TabsList>

                    <TabsContent value="table">
                        <VectorResults
                            results={results}
                            onRowClick={handleRowClick}
                            onDeleteClick={handleDeleteClick}
                            onShowVectorClick={handleShowVectorClick}
                            keyName={vectorSetName}
                            searchFilter={searchFilter}
                            searchQuery={searchQuery}
                            onClearFilter={() => setSearchFilter("")}
                            onAddVector={onAddVector}
                            isSearching={isSearching}
                            searchTime={searchTime}
                            isLoading={isLoading}
                            onBulkDeleteClick={handleBulkDeleteClick}
                            changeTab={changeTab}
                        />
                    </TabsContent>

                    <TabsContent value="2d">
                        <div
                            style={{
                                height: "calc(100vh - 400px)",
                                minHeight: "400px",
                            }}
                        >
                            {results[0] && (
                                <HNSW2dViz
                                    key={`${results[0][0]}-${searchCount}`}
                                    initialElement={{
                                        element: results[0][0],
                                        similarity: results[0][1],
                                        vector: results[0][2] || [],
                                    }}
                                    maxNodes={500}
                                    vectorSetName={vectorSetName}
                                    initialNodes={Number(searchCount)}
                                    getNeighbors={getNeighbors}
                                />
                            )}
                        </div>
                    </TabsContent>

                    {/* <TabsContent value="3d">
                        <div style={{ height: "calc(100vh - 400px)", minHeight: "400px" }}>
                            {results.length > 0 && (
                                <VectorViz3D
                                    data={results.map((result) => ({
                                        label: `${result[0]} (${result[1].toFixed(3)})`,
                                        vector: result[2] || [],
                                    }))}
                                    onVectorSelect={handleRowClick}
                                />
                            )}
                        </div>
                    </TabsContent> */}
                </Tabs>
            </div>
        </section>
    )
}

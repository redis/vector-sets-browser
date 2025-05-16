"use client"

import { useVectorSearch } from "@/app/vectorset/hooks/useVectorSearch"
import SearchBox from "@/components/SearchBox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { isImageEmbedding, isMultiModalEmbedding, isTextEmbedding } from "@/lib/embeddings/types/embeddingModels"
import { VectorTuple, vlinks, vsim } from "@/lib/redis-server/api"
import { VectorSetMetadata, VectorSetSearchOptions } from "@/lib/types/vectors"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import VectorViz3D from "../VisualizationTab/VectorViz3D"
import HNSW2dViz from "../VisualizationTab/vizualizer/HNSW2dViz"
import { DeleteVectorDialog } from "./DeleteVectorDialog"
import VectorResults from "./VectorResults"
import { SearchType } from "@/components/SearchOptions/SearchTypeSelector"
    
interface VectorSearchTabProps {
    vectorSetName: string
    dim: number | null
    metadata: VectorSetMetadata | null
    onAddVector: () => void
    onShowVector: (element: string) => Promise<number[] | null>
    onDeleteVector: (element: string) => Promise<void>
    onDeleteVector_multi: (elements: string[]) => Promise<void>
    handleAddVector?: (
        element: string,
        embedding: number[],
        useCAS?: boolean
    ) => Promise<void>
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
    handleAddVector,
    isLoading,
    results,
    setResults,
    changeTab,
}: VectorSearchTabProps) {
    // Initialize search options from userSettings
    const [activeResultsTab, setActiveResultsTab] = useState("table")
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [vectorToDelete, setVectorToDelete] = useState<string | null>(null)
    const [vectorsToDelete, setVectorsToDelete] = useState<string[]>([])
    const [isBulkDelete, setIsBulkDelete] = useState(false)
    const [resultsWithVectors, setResultsWithVectors] = useState<VectorTuple[]>([])

    // Initialize with basic search state - advanced options will be loaded from userSettings by useVectorSearch
    const [searchState, setSearchState] = useState<VectorSetSearchOptions>({
        searchType: "Vector" as SearchType,
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

    // Ref to track the last vector set name we processed
    const lastVectorSetRef = useRef<string | null>(null);
    // Ref to track if we've already set the default search type
    const searchTypeSetRef = useRef<boolean>(false);

    // Effect to fetch vectors when tab changes to 3D view
    useEffect(() => {
        const fetchVectorsFor3D = async () => {
            if (activeResultsTab === "3d" && vectorSetName && results.length > 0) {
                // Check if results already have vectors
                const needsVectors = results.some(result => !result[2] || result[2].length === 0);
                
                if (needsVectors) {
                    try {
                        // Re-fetch search results with embeddings
                        const elements = results.map(r => r[0]);
                        const count = results.length;
                        
                        // Get the first element to use as search base
                        const searchElement = elements[0];
                        
                        const response = await vsim({
                            keyName: vectorSetName,
                            searchElement,
                            count,
                            withEmbeddings: true, // Always get embeddings for 3D viz
                        });
                        
                        if (response.success && response.result) {
                            // Update results with the vector data
                            setResultsWithVectors(response.result);
                        }
                    } catch (error) {
                        console.error("Error fetching vectors for 3D visualization:", error);
                    }
                } else {
                    // If vectors already present, just use the existing results
                    setResultsWithVectors(results);
                }
            }
        };
        
        fetchVectorsFor3D();
    }, [activeResultsTab, vectorSetName, results]);

    const handleSearchResults = useCallback(
        (newResults: VectorTuple[]) => {
            setResults(newResults)
            
            // Check if results already have vectors
            const hasVectors = newResults.some(result => 
                Array.isArray(result[2]) && result[2].length > 0
            );
            
            // Update resultsWithVectors if vectors are present
            if (hasVectors) {
                setResultsWithVectors(newResults);
            }
        },
        [setResults, setResultsWithVectors]
    )

    const handleStatusChange = useCallback(() => {}, [])

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
        lastTextEmbedding,
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

    // Effect to set default search type only when vector set changes
    useEffect(() => {
        // Skip if there's no metadata or if we're dealing with the same vector set
        if (!metadata || vectorSetName === lastVectorSetRef.current) return;
        
        // Update last vector set ref
        lastVectorSetRef.current = vectorSetName;
        
        // Use setTimeout to defer the search type update until after render
        setTimeout(() => {
            // Reset the search type only if we have a new vector set
            if (metadata.embedding.provider && metadata.embedding.provider !== "none") {
                let newSearchType: SearchType;

                newSearchType = "Vector";
                
                // Only update search type if it's different
                if (searchType !== newSearchType) {
                    setSearchType(newSearchType);
                }
                
                searchTypeSetRef.current = true;
            }
        }, 0);
    }, [vectorSetName, metadata, setSearchType]);

    const handleSearchQueryChange = (query: string) => {
        setSearchQuery(query)
    }

    const handleRowClick = async (element: string) => {
        setSearchType("Element")
        setSearchQuery(element)
    }
    const handleBulkDeleteClick = (elements: string[]) => {
        setVectorsToDelete(elements)
        setIsBulkDelete(true)
        setDeleteDialogOpen(true)
    }
    const handleDeleteClick = (e: React.MouseEvent, element: string) => {
        e.stopPropagation()
        setVectorToDelete(element)
        setIsBulkDelete(false)
        setDeleteDialogOpen(true)
    }

    const handleConfirmDelete = () => {
        if (isBulkDelete) {
            console.log("Deleting vectors:", vectorsToDelete)
            onDeleteVector_multi(vectorsToDelete)
        } else if (vectorToDelete) {
            onDeleteVector(vectorToDelete)
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
        count: number
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
            <DeleteVectorDialog
                isOpen={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                onConfirm={handleConfirmDelete}
                vectorName={vectorToDelete || ""}
                isMultiDelete={isBulkDelete}
                vectorCount={vectorsToDelete.length}
            />
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
                lastTextEmbedding={lastTextEmbedding}
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
                        <TabsTrigger value="3d" className="w-full">
                            3D Visualization
                        </TabsTrigger>
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
                            handleAddVectorWithImage={handleAddVector}
                            metadata={metadata}
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

                    <TabsContent value="3d">
                        <div
                            style={{
                                height: "calc(100vh - 400px)",
                                minHeight: "400px",
                            }}
                        >
                            {resultsWithVectors.length > 0 && (
                                <VectorViz3D
                                    data={resultsWithVectors.map((result) => {
                                        // Create an array with 3 zeros as fallback
                                        const fallbackVector = new Array(3).fill(0);
                                        
                                        // Ensure vector exists and has data
                                        const vector = Array.isArray(result[2]) && result[2].length > 0 
                                            ? result[2] 
                                            : fallbackVector;
                                        
                                        return {
                                            label: `${result[0]} (${result[1].toFixed(3)})`,
                                            vector: vector,
                                        };
                                    })}
                                    onVectorSelect={handleRowClick}
                                />
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </section>
    )
}

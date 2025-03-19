"use client"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useCallback, useEffect, useState } from "react"
import { VectorTuple, vlinks } from "@/app/redis-server/api"
import SearchBox from "@/app/components/SearchBox"
import SearchTimeIndicator from "@/app/components/SearchTimeIndicator"
import StatusMessage from "@/app/components/StatusMessage"
import {
    useVectorSearch,
    VectorSetSearchState,
} from "@/app/hooks/useVectorSearch"
import { VectorSetMetadata } from "@/app/embeddings/types/config"
import VectorViz3D from "./VectorViz3D"
import HNSWVizPure from "./vizualizer/HNSWVizPure"

interface VectorSetVisualizationProps {
    vectorSetName: string
    dim: number
    metadata: VectorSetMetadata | null
}

export default function VectorSetVisualization({
    vectorSetName,
    dim,
    metadata,
}: VectorSetVisualizationProps) {
    const [vizType, setVizType] = useState<"2d" | "3d">("2d")
    const [fileOperationStatus, setFileOperationStatus] = useState("")
    const [results, setResults] = useState<VectorTuple[]>([])
    const [isVectorSetChanging, setIsVectorSetChanging] = useState(false)
    const [searchState, setSearchState] = useState<VectorSetSearchState>({
        searchType: "Vector" as const,
        searchQuery: "",
        searchCount: "10",
        searchFilter: "",
        resultsTitle: "Search Results",
        searchTime: undefined as string | undefined,
        expansionFactor: undefined,
    })

    // Track vector set changes
    useEffect(() => {
        setIsVectorSetChanging(true)
        setResults([])
    }, [vectorSetName])

    // Track when results arrive after vector set change
    useEffect(() => {
        if (isVectorSetChanging && results.length > 0) {
            setIsVectorSetChanging(false)
        }

        // Debug log to see the structure of results
        console.log("VectorSetVisualization results:", results)
    }, [results, isVectorSetChanging])

    const handleSearchStateChange = useCallback(
        (newState: Partial<VectorSetSearchState>) => {
            setSearchState((prevState) => ({
                ...prevState,
                ...newState,
            }))
        },
        []
    )

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
    } = useVectorSearch({
        vectorSetName,
        metadata,
        fetchEmbeddings: true, // Always fetch embeddings for visualization
        onSearchResults: setResults,
        onStatusChange: setFileOperationStatus,
        searchState,
        onSearchStateChange: handleSearchStateChange,
    })

    const getNeighbors = async (
        element: string,
        count: number,
        withEmbeddings?: boolean
    ) => {
        try {
            const data = await vlinks({
                keyName: vectorSetName,
                element,
                count,
                withEmbeddings: true, // Always fetch embeddings
            })

            // data is an array of arrays
            // each inner array contains [element, similarity, vector]
            // we want to return an array of objects with the following structure:
            // { element: string, similarity: number, vector: number[] }
            const response = data.flat().map((item) => ({
                element: item[0],
                similarity: item[1],
                vector: item[2],
            }))

            console.log("[getNeighbors] retreived Neighbors: ", response)
            return response
        } catch (error) {
            console.error("Error fetching neighbors:", error)
            return []
        }
    }

    const handleRowClick = async (element: string) => {
        setSearchType("Element")
        setSearchQuery(element)
    }

    return (
        <div className="flex flex-col h-full">
            <SearchBox
                vectorSetName={vectorSetName}
                searchType={searchType}
                setSearchType={setSearchType}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                searchFilter={searchFilter}
                setSearchFilter={setSearchFilter}
                dim={dim}
                metadata={metadata}
                searchCount={searchCount}
                setSearchCount={setSearchCount}
                error={fileOperationStatus}
                clearError={() => setFileOperationStatus("")}
                expansionFactor={searchState.expansionFactor}
                setExpansionFactor={(factor) =>
                    setSearchState({ ...searchState, expansionFactor: factor })
                }
            />
            <div className="bg-white rounded shadow-md h-[calc(100vh-300px)]">
                <div className="p-4 rounded shadow-md flex-1 flex flex-col">
                    <div className="flex mb-4 items-center">
                        <div className="flex items-center gap-4 w-full">
                            {(searchTime || isSearching) && (
                                <div className="text-sm text-gray-500 mb-4">
                                    <div className="flex items-center gap-4">
                                        <SearchTimeIndicator
                                            searchTime={
                                                searchTime
                                                    ? Number(searchTime)
                                                    : undefined
                                            }
                                            isSearching={isSearching}
                                        />
                                    </div>
                                </div>
                            )}
                            <StatusMessage message={fileOperationStatus} />
                            <div className="grow"></div>
                            <div className="mb-4 flex items-center gap-2">
                                <label className="text-sm font-medium text-gray-700">
                                    Visualization Type
                                </label>
                                <Select
                                    value={vizType}
                                    onValueChange={(value) =>
                                        setVizType(value as "2d" | "3d")
                                    }
                                >
                                    <SelectTrigger className="w-[120px]">
                                        <SelectValue placeholder="Select type..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="2d">
                                            2D Graph
                                        </SelectItem>
                                        <SelectItem value="3d">
                                            3D Vectors
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <div
                        className="flex-grow flex-1"
                        style={{ minHeight: "calc(100vh - 400px)" }}
                    >
                        {results[0] && !isVectorSetChanging ? (
                            vizType === "2d" ? (
                                <HNSWVizPure
                                    key={`${results[0][0]}-${searchCount}`}
                                    initialElement={{
                                        element: results[0][0],
                                        similarity: results[0][1],
                                        vector: results[0][2] || [],
                                    }}
                                    maxNodes={500}
                                    initialNodes={Number(searchCount)}
                                    getNeighbors={getNeighbors}
                                />
                            ) : (
                                <VectorViz3D
                                    data={results.map((result) => ({
                                        label: `${
                                            result[0]
                                        } (${result[1].toFixed(3)})`,
                                        vector: result[2] || [],
                                    }))}
                                    onVectorSelect={handleRowClick}
                                />
                            )
                        ) : (
                            "No Results Found"
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

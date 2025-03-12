"use client"

import { useState, useEffect } from "react"
import SearchBox from "./SearchBox"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import StatusMessage from "./StatusMessage"
import SearchTimeIndicator from "./SearchTimeIndicator"
import HNSWVizPure from "./vizualizer/HNSWVizPure"
import VectorViz3D from "./VectorViz3D"
import { useVectorSearch, VectorSetSearchState } from "../hooks/useVectorSearch"
import { VectorSetMetadata } from "../types/embedding"
import { VectorTuple } from "../api/types"
import * as redis from "../services/redis"

interface VectorSetVisualizationProps {
    vectorSetName: string
    dim: number
    metadata: VectorSetMetadata | null
    searchState: VectorSetSearchState | null
    onSearchStateChange: (state: VectorSetSearchState) => void
}

export default function VectorSetVisualization({
    vectorSetName,
    dim,
    metadata,
    searchState: initialSearchState,
    onSearchStateChange,
}: VectorSetVisualizationProps) {
    const [vizType, setVizType] = useState<"2d" | "3d">("2d")
    const [fileOperationStatus, setFileOperationStatus] = useState("")
    const [results, setResults] = useState<VectorTuple[]>([])
    const [isVectorSetChanging, setIsVectorSetChanging] = useState(false)

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
    }, [results, isVectorSetChanging])

    // Wrap onSearchStateChange to handle the type mismatch
    const handleSearchStateChange = (state: Partial<VectorSetSearchState>) => {
        // Ensure we have a complete state before calling the parent handler
        const completeState: VectorSetSearchState = {
            searchType: state.searchType ?? "Vector",
            searchQuery: state.searchQuery ?? "",
            searchCount: state.searchCount ?? "10",
            searchFilter: state.searchFilter ?? "",
            resultsTitle: state.resultsTitle ?? "Search Results",
        }
        onSearchStateChange(completeState)
    }

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
        searchState: initialSearchState || {
            searchType: "Vector",
            searchQuery: "",
            searchCount: "10",
            searchFilter: "",
            resultsTitle: "Search Results",
        },
        onSearchStateChange: handleSearchStateChange,
    })

    const getNeighbors = async (
        element: string,
        count: number,
        withEmbeddings?: boolean
    ) => {
        try {
            const data = await redis.vlinks(
                vectorSetName,
                element,
                count,
                true // Always fetch embeddings
            )
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

    const handleRowClick = async (element: string) => {
        setSearchType("Element")
        setSearchQuery(element)
    }

    return (
        <div>
            <SearchBox
                vectorSetName={vectorSetName}
                searchType={searchType}
                setSearchType={setSearchType}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                searchCount={searchCount}
                setSearchCount={setSearchCount}
                searchFilter={searchFilter}
                setSearchFilter={setSearchFilter}
                dim={dim}
                metadata={metadata}
            />
            <div className="bg-white rounded shadow-md h-[calc(100vh-300px)]">
                <div className="p-4 rounded shadow-md flex-1 flex flex-col">
                    <div className="flex mb-4 items-center">
                        <div className="flex items-center gap-4 w-full">
                            <StatusMessage message={fileOperationStatus} />
                            <div className="grow"></div>
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
                            <Select
                                value={vizType}
                                onValueChange={(value: "2d" | "3d") =>
                                    setVizType(value)
                                }
                            >
                                <SelectTrigger className="w-[100px]">
                                    <SelectValue placeholder="Visualization" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="2d">2D View</SelectItem>
                                    <SelectItem value="3d">3D View</SelectItem>
                                </SelectContent>
                            </Select>
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
                                    data={results.map(
                                        ([label, score, vector]) => ({
                                            label: `${label} (${score.toFixed(
                                                3
                                            )})`,
                                            vector,
                                        })
                                    )}
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
